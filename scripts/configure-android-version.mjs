import fs from 'node:fs';
import path from 'node:path';

const [version, runNumber] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  throw new Error('Provide an Android version in MAJOR.MINOR.PATCH format.');
}

if (!/^\d+$/.test(runNumber ?? '')) {
  throw new Error('Provide the GitHub Actions run number.');
}

const versionCode = 100000 + Number(runNumber);
if (!Number.isSafeInteger(versionCode) || versionCode > 2_100_000_000) {
  throw new Error('The generated Android versionCode is out of range.');
}

const gradlePath = path.resolve('android/app/build.gradle');
if (!fs.existsSync(gradlePath)) {
  throw new Error(`Android Gradle file not found: ${gradlePath}`);
}

let gradle = fs.readFileSync(gradlePath, 'utf8');
const versionCodePattern = /^(\s*versionCode\s+)\d+(\s*)$/gm;
const versionNamePattern = /^(\s*versionName\s+)(["'])([^"']*)\2(\s*)$/gm;
const versionCodeMatches = [...gradle.matchAll(versionCodePattern)];
const versionNameMatches = [...gradle.matchAll(versionNamePattern)];

if (versionCodeMatches.length !== 1 || versionNameMatches.length !== 1) {
  throw new Error('Could not find Android versionCode and versionName settings.');
}

gradle = gradle.replace(versionCodePattern, `$1${versionCode}$2`);
gradle = gradle.replace(versionNamePattern, `$1"${version}"$4`);
fs.writeFileSync(gradlePath, gradle);
