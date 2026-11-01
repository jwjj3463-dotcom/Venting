import fs from 'node:fs';
import path from 'node:path';

const androidRoot = path.resolve('android/app/src/main');
const manifestPath = path.join(androidRoot, 'AndroidManifest.xml');
const appId = process.env.ADMOB_APP_ID?.trim() || 'ca-app-pub-3940256099942544~3347511713';

if (!/^ca-app-pub-\d{16}~\d{10}$/.test(appId)) {
  throw new Error('ADMOB_APP_ID must be a valid AdMob application ID.');
}

if (!fs.existsSync(manifestPath)) {
  throw new Error(`Android manifest not found: ${manifestPath}`);
}

const manifest = fs.readFileSync(manifestPath, 'utf8');
const metadataName = 'com.google.android.gms.ads.APPLICATION_ID';
const metadata = `    <meta-data android:name="${metadataName}" android:value="@string/admob_app_id" />`;
const updatedManifest = manifest.includes(metadataName)
  ? manifest.replace(
      new RegExp(`<meta-data[^>]*android:name="${metadataName}"[^>]*/>`),
      metadata
    )
  : manifest.replace('</application>', `${metadata}\n  </application>`);

if (updatedManifest === manifest && !manifest.includes(metadataName)) {
  throw new Error('Could not add the AdMob application ID to AndroidManifest.xml.');
}

const valuesDir = path.join(androidRoot, 'res/values');
fs.mkdirSync(valuesDir, { recursive: true });
fs.writeFileSync(
  path.join(valuesDir, 'admob_strings.xml'),
  `<resources>\n    <string name="admob_app_id">${appId}</string>\n</resources>\n`
);
fs.writeFileSync(manifestPath, updatedManifest);
