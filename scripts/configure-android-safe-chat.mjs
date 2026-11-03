import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appRoot = path.join(root, 'android/app');
const javaRoot = path.join(appRoot, 'src/main/java');
const templatePath = path.join(root, 'scripts/android/SafeChatCapturePlugin.java');

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

if (!fs.existsSync(javaRoot) || !fs.existsSync(templatePath)) {
  throw new Error('Generated Android project or Safe Chat plugin template is missing.');
}

const mainActivityPath = findMainActivity(javaRoot);
if (!mainActivityPath) throw new Error('Generated Android MainActivity.java was not found.');

const activitySource = fs.readFileSync(mainActivityPath, 'utf8');
const packageName = activitySource.match(/^package\s+([a-zA-Z0-9_.]+);/m)?.[1];
if (!packageName) throw new Error('Could not read the MainActivity Java package.');

const pluginSource = fs.readFileSync(templatePath, 'utf8').replaceAll('__PACKAGE__', packageName);
fs.writeFileSync(
  path.join(path.dirname(mainActivityPath), 'SafeChatCapturePlugin.java'),
  pluginSource
);

let updatedActivity = activitySource;
if (!updatedActivity.includes('SafeChatCapturePlugin.class')) {
  const registration = updatedActivity.match(/^(\s*)registerPlugin\(([\w.]+)\.class\);/m);
  if (registration) {
    updatedActivity = updatedActivity.replace(
      registration[0],
      `${registration[0]}\n${registration[1]}registerPlugin(SafeChatCapturePlugin.class);`
    );
  } else {
    updatedActivity = updatedActivity.replace(
      /(public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s*\{\s*)/,
      '$1\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(SafeChatCapturePlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n'
    );
  }
}

if (!updatedActivity.includes('SafeChatCapturePlugin.class')) {
  throw new Error('Could not register SafeChatCapturePlugin in MainActivity.');
}
fs.writeFileSync(mainActivityPath, updatedActivity);
