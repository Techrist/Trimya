# Icônes PWA — Trimya Pro

Ce dossier contient les icônes servies par l'app **Trimya Pro** (kiosque salon
+ propriétaire chaîne) quand le build cible `pro`. Les fichiers remplacent
`public/icons/*` au moment du build Pro (voir `scripts/build-web.js`).

## Fichiers attendus

Tous en PNG, fond transparent ou sombre (`#0A0A0A`) — jamais blanc :

| Fichier               | Taille      | Usage                                        |
|-----------------------|-------------|----------------------------------------------|
| `icon-192.png`        | 192 × 192   | Icône PWA standard (home-screen Android)     |
| `icon-512.png`        | 512 × 512   | Splash / app list Android                    |
| `icon-maskable.png`   | 512 × 512   | Icône adaptive avec marge de 10 % (safe-zone)|

## Source

À générer depuis `assets/icon-pro.png` (1024 × 1024) avec :

```bash
# Avec sharp-cli (npm i -g sharp-cli)
npx sharp-cli resize 192 192 -i assets/icon-pro.png -o public/icons-pro/icon-192.png
npx sharp-cli resize 512 512 -i assets/icon-pro.png -o public/icons-pro/icon-512.png
npx sharp-cli resize 512 512 -i assets/icon-pro.png -o public/icons-pro/icon-maskable.png
```

Ou en ligne : https://realfavicongenerator.net (paramétrer “Trimya Pro”,
marge 10 % pour la version maskable).

## État actuel

Pour l'instant ce sont des **copies des icônes client** (fallback). Remplace-les
par les variantes Pro officielles (avec badge `PRO`) et commit le dossier.
Le build script détecte la présence des fichiers et les utilise
automatiquement pour `dist-pro/`.
