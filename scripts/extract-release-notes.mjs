import { appendFileSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const version = process.argv[2]?.replace(/^v/, '');
const outputFile = process.env.GITHUB_OUTPUT;
if (!version || !/^\d+\.\d+\.\d+$/.test(version) || !outputFile) {
  throw new Error('A semantic release version and GitHub Actions output file are required.');
}

const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const heading = new RegExp(`^##\\s+${version}(?:\\s|$)`, 'm');
const match = heading.exec(changelog);
if (!match) {
  throw new Error(`CHANGELOG.md has no release notes for ${version}.`);
}

const sectionStart = match.index + match[0].length;
const remaining = changelog.slice(sectionStart);
const nextSection = /^##\s/m.exec(remaining);
const body = remaining.slice(0, nextSection?.index ?? remaining.length).trim();
if (!body) {
  throw new Error(`CHANGELOG.md release notes for ${version} are empty.`);
}

const delimiter = `RELEASE_NOTES_${randomBytes(12).toString('hex')}`;
appendFileSync(outputFile, `body<<${delimiter}\n${body}\n${delimiter}\n`);
