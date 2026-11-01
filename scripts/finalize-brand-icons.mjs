import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const iconsDir = path.join(root, 'public', 'assets', 'icons');
const manifestPath = path.join(root, 'public', 'manifest.webmanifest');
const sourcePath = path.join(root, 'resources', 'logo.png');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

for (const filename of await fs.readdir(iconsDir)) {
  if (filename.startsWith('apple-splash-')) {
    await fs.rm(path.join(iconsDir, filename));
  }
}

for (const icon of manifest.icons ?? []) {
  const sourceName = path.basename(icon.src);
  const source = path.join(iconsDir, sourceName);
  const targetName = sourceName.replace(/\.webp$/, '.png');
  const target = path.join(iconsDir, targetName);

  if (source !== target) {
    await fs.rename(source, target);
  }

  icon.src = `assets/icons/${targetName}`;
  icon.type = 'image/png';
  icon.purpose = 'any';
}

const maskablePath = path.join(iconsDir, 'icon-maskable-512.png');
const foreground = await sharp(sourcePath).resize(280, 280).png().toBuffer();
const maskable = await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: '#2D1B69',
  },
})
  .composite([{ input: foreground, gravity: 'center' }])
  .png()
  .toFile(maskablePath);

manifest.icons = (manifest.icons ?? []).filter(
  (icon) => !icon.src.endsWith('icon-maskable-512.png')
);
manifest.icons.push({
  src: 'assets/icons/icon-maskable-512.png',
  type: 'image/png',
  sizes: `${maskable.width}x${maskable.height}`,
  purpose: 'maskable',
});

await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
