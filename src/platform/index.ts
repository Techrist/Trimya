/**
 * Point d'entrée des abstractions multi-plateformes.
 *
 * Toujours importer depuis `@/platform` plutôt que directement depuis
 * `expo-haptics`, `expo-secure-store`, etc. — ça garantit que les écrans
 * ne cassent pas quand ils sont rendus en web.
 *
 * Règle : chaque fichier de ce dossier respecte le principe « jamais de
 * succès fictif » du PDF — si la plateforme ne supporte pas une capacité,
 * on retourne `null`/`false`/une sentinel claire, jamais une valeur bidon.
 */
export * as haptics from './haptics';
export * as secureStore from './secureStore';
export * as wakeLock from './wakeLock';
export { detectPlatform, type PlatformInfo } from './detectPlatform';
