#!/usr/bin/env node
/**
 * Régénère les icônes PWA client ET pro à partir des sources logo-mark.
 *
 * Problème que ça adresse : avec les icônes historiques, le "T" Trimya
 * apparaît trop petit sur l'écran d'accueil iOS/Android — beaucoup de
 * padding transparent autour. Ce script trim l'alpha des sources puis
 * composite le T sur un carré sombre à 85 % du canvas (60 % pour la
 * version maskable qui a une safe-zone de 80 %).
 *
 * Sortie :
 *   public/icons/icon-192.png              (client, 85 %)
 *   public/icons/icon-512.png              (client, 85 %)
 *   public/icons/icon-maskable.png         (client, 60 %, safe-zone)
 *   public/icons-pro/icon-192.png          (pro,    85 %)
 *   public/icons-pro/icon-512.png          (pro,    85 %)
 *   public/icons-pro/icon-maskable.png     (pro,    60 %, safe-zone)
 *
 * Usage :
 *   node scripts/regen-pwa-icons.js
 */

const path = require('path');
const fs = require('fs');

// Sharp vit dans admin/node_modules (pas réinstallé côté app). On le
// require par son chemin absolu.
const sharp = require(
  path.join(__dirname, '..', 'admin', 'node_modules', 'sharp'),
);

const BG = { r: 10, g: 10, b: 13, alpha: 1 }; // #0A0A0D (bg app)
const SIZES = [192, 512];
const MASKABLE_SIZE = 512;

// Ratios indépendants par cible. Pro est poussé plus loin (T + badge PRO
// plus visibles) tout en gardant la safe-zone maskable (80%).
const CLIENT_T_RATIO = 0.85;
const CLIENT_MASKABLE_T_RATIO = 0.6;
const PRO_T_RATIO = 0.95;
const PRO_MASKABLE_T_RATIO = 0.7;

/**
 * Génère une icône carrée : trim l'alpha du source, scale le T à `tRatio`
 * du canvas, centré sur un bg sombre.
 */
async function buildIcon(sourcePath, outPath, size, tRatio) {
  const trimmed = await sharp(sourcePath)
    .trim({ threshold: 10 }) // retire le padding transparent
    .toBuffer();
  const targetT = Math.round(size * tRatio);
  const scaledT = await sharp(trimmed)
    .resize({
      width: targetT,
      height: targetT,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: scaledT, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  const stat = fs.statSync(outPath);
  console.log(
    `  wrote ${path.relative(path.join(__dirname, '..'), outPath)}  (${size}x${size}, ${Math.round(stat.size / 1024)} KB)`,
  );
}

(async () => {
  const root = path.join(__dirname, '..');
  const clientSource = path.join(root, 'assets', 'logo-mark.png');
  const proSource = path.join(root, 'assets', 'logo-mark-pro.png');

  if (!fs.existsSync(clientSource))
    throw new Error(`Source missing: ${clientSource}`);
  if (!fs.existsSync(proSource))
    throw new Error(`Source missing: ${proSource}`);

  console.log('Regenerating CLIENT icons from assets/logo-mark.png …');
  const clientOut = path.join(root, 'public', 'icons');
  fs.mkdirSync(clientOut, { recursive: true });
  for (const size of SIZES) {
    await buildIcon(
      clientSource,
      path.join(clientOut, `icon-${size}.png`),
      size,
      CLIENT_T_RATIO,
    );
  }
  await buildIcon(
    clientSource,
    path.join(clientOut, 'icon-maskable.png'),
    MASKABLE_SIZE,
    CLIENT_MASKABLE_T_RATIO,
  );

  console.log('\nRegenerating PRO icons from assets/logo-mark-pro.png …');
  const proOut = path.join(root, 'public', 'icons-pro');
  fs.mkdirSync(proOut, { recursive: true });
  for (const size of SIZES) {
    await buildIcon(
      proSource,
      path.join(proOut, `icon-${size}.png`),
      size,
      PRO_T_RATIO,
    );
  }
  await buildIcon(
    proSource,
    path.join(proOut, 'icon-maskable.png'),
    MASKABLE_SIZE,
    PRO_MASKABLE_T_RATIO,
  );

  console.log('\n✓ Done. Run `npm run deploy:client && npm run deploy:pro` to ship.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
