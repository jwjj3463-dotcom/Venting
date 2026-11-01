import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const configPath = path.join(root, 'google-services.json');
const androidRoot = path.join(root, 'android');
const appRoot = path.join(androidRoot, 'app');
const rootGradlePath = path.join(androidRoot, 'build.gradle');
const appGradlePath = path.join(appRoot, 'build.gradle');

if (!fs.existsSync(configPath)) {
  throw new Error('Firebase Android configuration is missing: google-services.json');
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const packageName = firebaseConfig.client?.[0]?.client_info?.android_client_info?.package_name;
if (packageName !== 'com.fadfadahnative') {
  throw new Error(`Unexpected Firebase Android package name: ${packageName || 'missing'}`);
}

for (const requiredPath of [rootGradlePath, appGradlePath]) {
  if (!fs.existsSync(requiredPath)) {
    throw new Error(`Generated Android Gradle file not found: ${requiredPath}`);
  }
}

const rootGradle = fs.readFileSync(rootGradlePath, 'utf8');
const appGradle = fs.readFileSync(appGradlePath, 'utf8');
const googleServicesClasspath = "classpath 'com.google.gms:google-services:4.4.4'";
const appGoogleServicesPlugin = "apply plugin: 'com.google.gms.google-services'";

let updatedRootGradle = rootGradle;
if (!updatedRootGradle.includes('com.google.gms:google-services')) {
  const dependenciesBlock = updatedRootGradle.match(/dependencies\s*\{/);
  if (!dependenciesBlock || dependenciesBlock.index === undefined) {
    throw new Error('Could not locate the Android root Gradle buildscript dependencies.');
  }
  const insertionPoint = dependenciesBlock.index + dependenciesBlock[0].length;
  updatedRootGradle =
    updatedRootGradle.slice(0, insertionPoint) +
    `\n        ${googleServicesClasspath}` +
    updatedRootGradle.slice(insertionPoint);
}

const updatedAppGradle = appGradle.includes('com.google.gms.google-services')
  ? appGradle
  : `${appGradle.trimEnd()}\n\n${appGoogleServicesPlugin}\n`;

fs.copyFileSync(configPath, path.join(appRoot, 'google-services.json'));
fs.writeFileSync(rootGradlePath, updatedRootGradle);
fs.writeFileSync(appGradlePath, updatedAppGradle);
