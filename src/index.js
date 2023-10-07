// @ts-nocheck
const fs = require('fs');
const pathN = require('path');
const spawn = require('cross-spawn');
const { prompt } = require('enquirer');
const colors = require('picocolors');
const semver = require('semver');

const name = 'v';

const pkg = jsPackage();

/**
 * @type {import('semver').ReleaseType[]}
 */
const versionIncrements = [
  'patch',
  'minor',
  'major',
  'prepatch',
  'preminor',
  'premajor',
  'prerelease',
];

/**
 * @param {import('semver').ReleaseType} i
 */
function inc(i) {
  return semver.inc(pkg.version, i);
}

/**
 * @param {string} bin
 * @param {string[]} args
 * @param {object} opts
 */
function run(bin, args, opts = {}) {
  return spawn.sync(bin, args, { stdio: 'inherit', ...opts });
}

/**
 * @param {string} msg
 */
function step(msg) {
  console.log(colors.cyan(msg));
}

function jsPackage() {
  const path = pathN.resolve(process.cwd(), 'package.json');
  const content = fs.readFileSync(path, 'utf8');
  return {
    type: 'package',
    path,
    content,
    ...require(path),
    updateVersion(version) {
      const newContent = { ...JSON.parse(content), version };
      fs.writeFileSync(path, `${JSON.stringify(newContent, null, 2)}\n`);
    },
  };
}

async function main() {
  const { release } = await prompt({
    type: 'select',
    name: 'release',
    message: 'Select release type:',
    choices: [...versionIncrements.map((i) => `${i} (${inc(i)})`), 'custom'],
  });

  let targetVersion;
  if (release === 'custom') {
    const res = await prompt({
      type: 'input',
      name: 'version',
      message: 'Enter custom version:',
      initial: pkg.version,
    });
    targetVersion = res.version;
  } else {
    targetVersion = release.match(/\((.*)\)/)[1];
  }

  if (!semver.valid(targetVersion)) {
    throw new Error(`invalid target version: ${targetVersion}`);
  }

  const tag = `${name}${targetVersion}`;

  const { yes } = await prompt({
    type: 'confirm',
    name: 'yes',
    message: `Releasing ${tag}. Confirm?`,
  });

  if (!yes) {
    return;
  }

  step(`\nUpdating ${pkg.type} version...`);
  pkg.updateVersion(targetVersion);

  const { stdout } = run('git', ['diff'], { stdio: 'pipe' });
  if (stdout) {
    step('\nCommitting changes...');
    run('git', ['add', '-A']);
    run('git', ['commit', '-m', `chore: release ${tag}`, '--no-verify']);
    run('git', ['tag', '-a', tag, '-m', `chore: release ${tag}`]);
  } else {
    console.log('No changes to commit.');
  }

  step(`\nPublishing ${pkg.type}...`);

  step('\nPushing to GitHub...');
  run('git', ['push']);
  run('git', ['push', '--tags']);
  console.log();
}

main().catch((error) => {
  console.error(error);
});
