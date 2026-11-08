import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.join(
  process.cwd(),
  'android',
  'app',
  'src',
  'main',
  'AndroidManifest.xml'
);

if (!fs.existsSync(manifestPath)) {
  throw new Error('Generated Android manifest is missing.');
}

let manifest = fs.readFileSync(manifestPath, 'utf8');
const declarations = [
  '<uses-permission android:name="android.permission.CAMERA" />',
  '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
  '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
  '<uses-feature android:name="android.hardware.camera.any" android:required="false" />',
  '<uses-feature android:name="android.hardware.microphone" android:required="false" />',
];
const manifestOpening = manifest.match(/<manifest\b[^>]*>/);
if (!manifestOpening) throw new Error('Could not find the Android manifest root element.');

const missingDeclarations = declarations.filter((declaration) => {
  const name = declaration.match(/android:name="([^"]+)"/)?.[1];
  return name && !manifest.includes(`android:name="${name}"`);
});
if (missingDeclarations.length > 0) {
  manifest = manifest.replace(
    manifestOpening[0],
    `${manifestOpening[0]}\n    ${missingDeclarations.join('\n    ')}`
  );
  fs.writeFileSync(manifestPath, manifest);
}
