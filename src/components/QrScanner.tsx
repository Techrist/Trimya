/**
 * Entry point par défaut du composant QrScanner.
 *
 * Metro + react-native-web appliquent une résolution de plateforme
 * automatique : un `import './QrScanner'` chargera `.native.tsx` sur
 * iOS/Android et `.web.tsx` sur web. Ce fichier `.tsx` sert de fallback
 * si jamais un bundler ignore les extensions plateforme — on re-exporte
 * la version native par défaut.
 */
export { QrScanner } from './QrScanner.native';
export type { QrScannerProps, QrScannerError } from './QrScanner.types';
