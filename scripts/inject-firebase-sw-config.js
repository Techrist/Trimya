#!/usr/bin/env node
/**
 * Script post-build qui injecte la config Firebase publique dans
 * `firebase-messaging-sw.js` (le SW ne peut pas lire `process.env`
 * côté client — on remplace les placeholders au moment de l'export web).
 *
 * Lance : `node scripts/inject-firebase-sw-config.js dist/`
 *
 * À exécuter après `expo export --platform web` et avant le déploiement
 * (firebase deploy --only hosting / Vercel).
 */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node scripts/inject-firebase-sw-config.js <dist-dir>');
  process.exit(1);
}

const swPath = path.join(dir, 'firebase-messaging-sw.js');
if (!fs.existsSync(swPath)) {
  console.error(`[inject-sw] file not found: ${swPath}`);
  process.exit(1);
}

const requiredVars = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
];

// Charge .env.local puis .env (préférence au local pour écraser)
function loadDotenv(file) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) return;
  const content = fs.readFileSync(p, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) return;
    const [, key, rawValue] = m;
    if (!process.env[key]) {
      const value = rawValue.replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}
loadDotenv('.env.local');
loadDotenv('.env');

const missing = requiredVars.filter((v) => !process.env[v]);
if (missing.length) {
  console.error('[inject-sw] missing env vars:', missing.join(', '));
  process.exit(1);
}

let sw = fs.readFileSync(swPath, 'utf8');

// Pattern : on remplace les lignes `self.FIREBASE_X || '__INJECTED_AT_RUNTIME__'`
// par un simple littéral '<valeur>'.
const map = {
  FIREBASE_API_KEY: 'EXPO_PUBLIC_FIREBASE_API_KEY',
  FIREBASE_AUTH_DOMAIN: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  FIREBASE_PROJECT_ID: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  FIREBASE_STORAGE_BUCKET: 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  FIREBASE_MESSAGING_SENDER_ID: 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  FIREBASE_APP_ID: 'EXPO_PUBLIC_FIREBASE_APP_ID',
};
for (const [swKey, envKey] of Object.entries(map)) {
  const value = process.env[envKey];
  const re = new RegExp(`self\\.${swKey}\\s*\\|\\|\\s*'__INJECTED_AT_RUNTIME__'`, 'g');
  sw = sw.replace(re, JSON.stringify(value));
}

fs.writeFileSync(swPath, sw, 'utf8');
console.log(`[inject-sw] injected Firebase public config into ${swPath}`);
