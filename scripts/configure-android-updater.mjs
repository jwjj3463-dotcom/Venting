import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const androidRoot = path.join(root, 'android');
const appRoot = path.join(androidRoot, 'app');
const manifestPath = path.join(appRoot, 'src/main/AndroidManifest.xml');
const fileProviderPathsPath = path.join(appRoot, 'src/main/res/xml/file_paths.xml');
const templatePath = path.join(root, 'scripts/android/AndroidApkUpdaterPlugin.java');

function findMainActivity(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const found = findMainActivity(entryPath);
      if (found) return found;
    } else if (entry.name === 'MainActivity.java') {
      return entryPath;
    }
  }
  return null;
}

if (!fs.existsSync(manifestPath) || !fs.existsSync(templatePath)) {
  throw new Error('Generated Android project or updater source template is missing.');
}

const javaRoot = path.join(appRoot, 'src/main/java');
const mainActivityPath = findMainActivity(javaRoot);
if (!mainActivityPath) throw new Error('Generated Android MainActivity.java was not found.');

const activitySource = fs.readFileSync(mainActivityPath, 'utf8');
const packageName = activitySource.match(/^package\s+([a-zA-Z0-9_.]+);/m)?.[1];
if (!packageName) throw new Error('Could not read the MainActivity Java package.');

const pluginSource = fs.readFileSync(templatePath, 'utf8').replaceAll('__PACKAGE__', packageName);
const pluginPath = path.join(path.dirname(mainActivityPath), 'AndroidApkUpdaterPlugin.java');
fs.writeFileSync(pluginPath, pluginSource);

let updatedActivity = activitySource;
if (!updatedActivity.includes('AndroidApkUpdaterPlugin.class')) {
  updatedActivity = updatedActivity.replace(
    /public class MainActivity extends BridgeActivity\s*\{\s*\}/,
    `public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(AndroidApkUpdaterPlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n}`
  );
}
if (!updatedActivity.includes('AndroidApkUpdaterPlugin.class')) {
  throw new Error('Could not register the Android APK updater plugin in MainActivity.');
}
fs.writeFileSync(mainActivityPath, updatedActivity);

let manifest = fs.readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android.permission.REQUEST_INSTALL_PACKAGES')) {
  manifest = manifest.replace(
    '<application',
    '    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n\n    <application'
  );
}
if (!manifest.includes('androidx.core.content.FileProvider')) {
  const provider = [
    '        <provider',
    '            android:name="androidx.core.content.FileProvider"',
    '            android:authorities="${applicationId}.fileprovider"',
    '            android:exported="false"',
    '            android:grantUriPermissions="true">',
    '            <meta-data',
    '                android:name="android.support.FILE_PROVIDER_PATHS"',
    '                android:resource="@xml/file_paths" />',
    '        </provider>',
  ].join('\n');
  if (!manifest.includes('</application>')) {
    throw new Error('Generated Android manifest has no application closing tag.');
  }
  manifest = manifest.replace('</application>', `${provider}\n    </application>`);
}
fs.writeFileSync(manifestPath, manifest);

fs.mkdirSync(path.dirname(fileProviderPathsPath), { recursive: true });
const fileProviderPaths = `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="update_apks" path="fadfada-updates/" />
</paths>
`;
fs.writeFileSync(fileProviderPathsPath, fileProviderPaths);
