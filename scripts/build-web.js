#!/usr/bin/env node
/**
 * Build web Expo pour la cible choisie (`client` ou `pro`).
 *
 * Pourquoi ce script plutôt que `cross-env` dans un npm script ? Parce que
 * cross-env a des comportements inégaux selon le shell (Windows PowerShell /
 * CMD / bash / zsh), et sur certaines combinaisons `TRIMYA_APP` n'arrive
 * jamais jusqu'à `app.config.js`. Résultat : les deux builds produisent le
 * bundle client, et seule la cible Pro reste cassée en prod — difficile à
 * détecter sans ouvrir l'app.
 *
 * Ici on met la valeur directement dans `process.env` AVANT de spawn Expo,
 * dans le même processus Node. Expo hérite systématiquement de l'env, donc
 * `app.config.js` voit toujours `TRIMYA_APP` correctement.
 *
 * Usage :
 *   node scripts/build-web.js client
 *   node scripts/build-web.js pro
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const target = (process.argv[2] || '').toLowerCase();
if (target !== 'client' && target !== 'pro') {
  console.error('Usage: node scripts/build-web.js <client|pro>');
  process.exit(1);
}

// Force la cible dans l'env Node (secours) ET dans un fichier dédié que
// `app.config.js` lit en PRIORITÉ. Sans ce fichier, les sous-processus
// Expo (Metro worker, expo-constants manifest serializer) perdent la
// variable d'environnement sur Windows et retombent sur "client".
process.env.TRIMYA_APP = target;
const targetFile = path.join(process.cwd(), '.trimya-build-target');
fs.writeFileSync(targetFile, target, 'utf8');

const outDir = target === 'pro' ? 'dist-pro' : 'dist-client';

// Nettoyage préalable du bundle précédent + cache Expo. Un cache stale
// peut faire croire que le build est en 'pro' alors qu'il réutilise une
// couche 'client' compilée précédemment.
const absOut = path.join(process.cwd(), outDir);
if (fs.existsSync(absOut)) {
  fs.rmSync(absOut, { recursive: true, force: true });
}
const expoCache = path.join(process.cwd(), '.expo', 'web-build-cache');
if (fs.existsSync(expoCache)) {
  fs.rmSync(expoCache, { recursive: true, force: true });
}

console.log(`\n[build-web] Target = ${target.toUpperCase()}, output = ${outDir}\n`);

/**
 * Suppression du fichier marker après le build (succès ou échec). Comme
 * ça la source de vérité est toujours cohérente avec le build en cours
 * et un `npm start` sans script ne garde pas un état bloqué.
 */
function cleanup() {
  try {
    if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);
  } catch {
    // best-effort
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});

try {
  execSync(`npx expo export --platform web --output-dir ${outDir}`, {
    stdio: 'inherit',
    env: process.env,
  });
} catch (err) {
  console.error('[build-web] expo export failed');
  process.exit(err.status || 1);
}

// Injection de la config Firebase publique dans le SW FCM
try {
  execSync(`node scripts/inject-firebase-sw-config.js ${outDir}/`, {
    stdio: 'inherit',
    env: process.env,
  });
} catch (err) {
  console.error('[build-web] SW config injection failed');
  process.exit(err.status || 1);
}

console.log(`\n[build-web] ✓ ${target.toUpperCase()} bundle ready in ${outDir}/\n`);
