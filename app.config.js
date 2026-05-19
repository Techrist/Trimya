/**
 * Expo config dynamique.
 * - En dev local : utilise `./google-services.json` directement
 * - En EAS Build : utilise le secret `GOOGLE_SERVICES_JSON` (type file)
 *   qui est injecté comme un chemin de fichier dans process.env
 *
 * On garde `app.json` comme source de vérité statique et on ne fait
 * qu'overrider le champ `android.googleServicesFile` ici.
 *
 * Pour configurer le secret côté EAS :
 *   eas secret:create --scope project --name GOOGLE_SERVICES_JSON \
 *     --type file --value ./google-services.json
 */
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ??
      config.android?.googleServicesFile ??
      './google-services.json',
  },
});
