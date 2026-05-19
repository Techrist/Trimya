# Trimya — Sécurité

Ce document décrit le modèle de sécurité actuel de la plateforme, les actions
opérateur à faire pour la durcir au maximum, et les évolutions futures.

---

## Modèle de menaces couvert

| Vecteur d'attaque | Atténuation |
|---|---|
| Énumération anonyme des codes d'activation | Collection `activationCodes` **lookup-only** (get par id, list interdit). Le doc salon n'est plus lisible publiquement. |
| Vol de tablette / kiosque rogue | UID kiosque dans `kioskUserIds` — admin peut rotateChange/Reset depuis Trimya Admin (régénère le code + vide la liste). |
| Replay d'un screenshot QR | QR v3 inclut `exp` (60s de validité) + rotation toutes les 30s côté client. Le scanner refuse les QR expirés. |
| Spam de cuts par un kiosque compromis | Cloud Function `addCutSecure` impose un cooldown de 30s par client + transaction atomique. |
| Bot/script tapant Firestore | App Check (reCAPTCHA v3 admin + Play Integrity / DeviceCheck mobile) bloque les requêtes non signées par un device réel. |
| Quota Free contourné (51ᵉ client) | Cloud Function `enforceClientQuota` supprime le doc en trop et logge l'événement dans `planQuotaBlocked`. |
| Phishing / vol mot de passe admin | 2FA Firebase Auth + journal `adminPushLogs` (qui a fait quoi). |
| Énumération clients par un kiosque concurrent | Règles Firestore : `customers.list` exige `isSalonKiosk(resource.data.salonId)` ou `isAdmin()`. |
| Lecture des conversations privées | Règles Firestore : `messages.get` traverse la conv pour vérifier que l'appelant est le client OU le kiosque autorisé. |

---

## Architecture en couches

```
┌────────────────────────────────────────────────────────┐
│ COUCHE 1 — App Check                                   │
│  reCAPTCHA v3 (admin web) / Play Integrity (Android)   │
│  Refuse les requêtes ne venant pas d'un device réel.   │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│ COUCHE 2 — Firebase Auth                               │
│  Phone Auth (clients) / Anonymous (kiosques)           │
│  Email+password+2FA (admin)                            │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│ COUCHE 3 — Cloud Functions                             │
│  addCutSecure : cooldown, anti-replay QR, transactions │
│  enforceClientQuota : cap clients en plan Free         │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│ COUCHE 4 — Firestore Security Rules                    │
│  Read scopé par rôle (client / kiosque / admin)        │
│  Champs sensibles isolés dans salons/{id}/private/data │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│ COUCHE 5 — Trimya Admin API routes                     │
│  Bearer token + check rôle admin avant Admin SDK ops   │
└────────────────────────────────────────────────────────┘
```

---

## Actions opérateur (à faire dans cet ordre)

### 1. Publier les nouvelles règles Firestore

Source : `README.md` → section *Règles de sécurité Firestore*.
Copier-coller dans Firebase Console → Firestore → Rules → Publier.

### 2. Backfill des `activationCodes` pour les salons existants

Une fois Trimya Admin déployé/lancé :

```bash
# Depuis ton terminal, avec ton ID token admin :
curl -X POST https://<admin-url>/api/migrate/activation-codes \
  -H "Authorization: Bearer <token>"
```

Ou plus simple : régénère manuellement le code de chaque salon depuis la
fiche salon (le bouton "Régénérer" crée l'entrée automatiquement).

### 3. Déployer les Cloud Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

Premier déploiement : ~5 min. Les fonctions sont en `europe-west1`.

Coût estimé : la Free Tier de Firebase Functions est largement suffisante
jusqu'à ~50 000 invocations/mois (et tu factures bien avant ce volume).

### 4. Activer App Check dans Firebase Console

1. Firebase Console → **App Check** (menu de gauche)
2. **Apps** → enregistrer chaque app :
   - **Web (admin)** :
     - Provider : reCAPTCHA v3
     - Site key : générer un nouveau key sur [Google Cloud Console reCAPTCHA Enterprise](https://console.cloud.google.com/security/recaptcha)
     - Copier le site key dans `admin/.env.local` → `NEXT_PUBLIC_RECAPTCHA_SITE_KEY=...`
   - **Android (mobile)** :
     - Provider : Play Integrity (recommandé) ou SafetyNet (deprecated)
     - Nécessite que l'app Android soit publiée au moins en interne sur Google Play
   - **iOS (mobile)** :
     - Provider : DeviceCheck (Apple) ou App Attest (iOS 14+)
3. **APIs** → activer App Check sur :
   - Cloud Firestore : mode *Unenforced* d'abord (warn), puis *Enforced* après vérification
   - Cloud Functions : mode *Enforced*
4. Surveiller pendant quelques jours via *Metrics* → si pas de trafic légitime
   bloqué, passer Firestore en *Enforced*.

### 5. Activer 2FA pour le compte admin

1. Firebase Console → **Authentication** → onglet **Settings** → tab
   **User actions** → activer **Multi-factor authentication**.
2. Se reconnecter à Trimya Admin → suivre le prompt d'enrôlement SMS ou TOTP.

### 6. Sécuriser le service account

```bash
# Supprimer le fichier JSON téléchargé localement après l'avoir copié dans
# .env.local — réduit la surface en cas de compromission du poste.
del C:\Users\<toi>\Downloads\trimya-*-firebase-adminsdk-*.json
```

Rotation périodique recommandée : tous les 6 mois, générer une nouvelle
clé dans Firebase Console et révoquer l'ancienne.

### 7. Activer les alertes de facturation Firebase

Console GCP → **Billing** → **Budgets & alerts** → créer une alerte sur le
projet `trimya-68ae2` :
- Seuil à 50 % et 100 % du budget mensuel attendu
- Évite les mauvaises surprises en cas d'attaque DOS qui ferait exploser
  les invocations Cloud Functions / lectures Firestore.

---

## Limitations connues

### QR signing : sécurité partielle
Le QR v3 inclut un `exp` (expiration) mais **n'est pas signé** par une
clé serveur. Un utilisateur qui décompile l'app peut forger un QR avec
n'importe quel `exp`. Atténuation : la Cloud Function `addCutSecure`
vérifie `qrExp` côté serveur, donc même un QR forgé doit être présenté
dans la fenêtre temporelle.

Pour aller plus loin : implémenter un HMAC avec un secret stocké côté
serveur (Firestore privé + Cloud Function génère le QR signé toutes
les 30s). Coût : refacto ClientQrScreen + appel function périodique.

### App Check sur mobile React Native (Expo)
L'init JS côté Expo n'expose pas Play Integrity / DeviceCheck nativement.
Deux options :
1. **Dev build Expo** + plugin `@react-native-firebase/app-check` →
   support natif complet (chemin recommandé).
2. **Custom provider** qui demande un token à un endpoint serveur → plus
   complexe à maintenir.

Pour la phase actuelle, App Check est actif uniquement sur l'admin web.
Le mobile passe sans App Check tant que le dev build natif n'est pas en
place.

### Quotas client : enforcement asynchrone
La Cloud Function `enforceClientQuota` se déclenche **après** la création
du customer. Il y a donc une fenêtre de quelques secondes pendant laquelle
le client peut interagir. Pour un enforcement strict, transformer
l'inscription en Cloud Function callable.

---

## Audit log à instrumenter (futur)

Collections à mettre en place pour traçabilité :

```
auditLog/{id}
  - actorUid: string         (qui a agi)
  - actorRole: 'admin' | 'kiosk' | 'customer'
  - action: string           (e.g. 'salon.plan.upgrade')
  - target: { kind, id }     (ressource visée)
  - before, after: object    (diff)
  - timestamp: number
  - ip?: string              (si dispo via Functions)
```

Écrite uniquement par les Cloud Functions et API admin pour les opérations
sensibles : changement de plan, régénération de code, désactivation salon,
suppression d'un kiosque, envoi de push à grand volume.

---

## Tests de pénétration recommandés (post-déploiement)

Vérifier régulièrement avec un compte de test :

- [ ] Lister `salons` sans auth → doit échouer (`Missing or insufficient permissions`)
- [ ] Lister `customers` avec auth client lambda → doit échouer
- [ ] Lire `messages` d'une conv où on n'est ni client ni kiosque → doit échouer
- [ ] Tenter d'écrire `cuts` avec un UID non-kiosque → doit échouer
- [ ] Tenter d'écrire `salons/{id}/private/data` depuis un client → doit échouer
- [ ] Énumérer `activationCodes/<random>` → renvoie not-found mais pas la liste
- [ ] Appeler `addCutSecure` sans App Check token → doit échouer (une fois App Check enforced)
- [ ] Forger un QR avec `exp` futur (10 min) → `addCutSecure` doit refuser via `qr_from_future`
