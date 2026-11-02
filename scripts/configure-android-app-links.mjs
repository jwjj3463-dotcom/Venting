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
const host = process.env.ANDROID_APP_LINK_HOST || 'fadfada.94.237.56.203.nip.io';

if (!/^[a-z0-9.-]+$/i.test(host)) {
  throw new Error('ANDROID_APP_LINK_HOST must be a DNS hostname.');
}
if (!fs.existsSync(manifestPath)) {
  throw new Error('Generated Android manifest is missing.');
}

let manifest = fs.readFileSync(manifestPath, 'utf8');
const activityPattern = /<activity\b(?=[^>]*android:name="[^"]*MainActivity")[\s\S]*?<\/activity>/;
const activity = manifest.match(activityPattern)?.[0];
if (!activity) {
  throw new Error('Could not find the generated Android MainActivity declaration.');
}

if (!activity.includes(`android:host="${host}"`)) {
  const intentFilter = [
    '            <intent-filter android:autoVerify="true">',
    '                <action android:name="android.intent.action.VIEW" />',
    '                <category android:name="android.intent.category.DEFAULT" />',
    '                <category android:name="android.intent.category.BROWSABLE" />',
    '                <data',
    '                    android:scheme="https"',
    `                    android:host="${host}"`,
    '                    android:pathPrefix="/u/" />',
    '            </intent-filter>',
  ].join('\n');
  manifest = manifest.replace(activity, activity.replace('</activity>', `${intentFilter}\n        </activity>`));
}

fs.writeFileSync(manifestPath, manifest);
