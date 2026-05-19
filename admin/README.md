# Trimya Admin

Console web de pilotage de la plateforme Trimya (Next.js 16 + Tailwind 4 + Firebase).

Trois fonctionnalités essentielles pour le MVP :
1. **Dashboard** — KPIs globaux + graphique d'activité 30 jours
2. **CRUD salons** — créer, voir, désactiver, régénérer le code d'activation
3. **Notifications push** — envoyer à un salon, à tous les clients, ou à toutes les tablettes

---

## Mise en route (10 minutes)

### 1. Pré-requis

Tu dois déjà avoir :
- Le projet Firebase de Trimya (le même que pour l'app mobile)
- Node.js 20+

### 2. Installer les dépendances

Depuis la racine de `admin/` :

```bash
npm install
```

### 3. Récupérer la config Firebase (Web SDK)

Firebase Console → Project settings → *Your apps* → ton app Web → copie la config.

### 4. Générer un Service Account (Admin SDK)

Firebase Console → Project settings → onglet **Service accounts** → **Generate new private key**.

Tu obtiens un fichier JSON. Tu vas **copier tout son contenu sur une seule ligne** dans `.env.local`.

### 5. Créer `.env.local`

```bash
cp .env.example .env.local
```

Édite et remplis :

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=trimya.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=trimya
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=trimya.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Tout le JSON du service account, sur une seule ligne :
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"trimya",...}
```

> ⚠️ Ne **jamais** committer `.env.local` ni le fichier JSON du service account.

### 6. Activer Email/Password dans Firebase Auth

Firebase Console → Authentication → Sign-in method → **Email/Password** → Activer.

### 7. Créer ton compte admin

1. **Authentication** → Users → *Add user* → email + mot de passe
2. Copie l'UID du compte créé
3. **Firestore** → crée un document :
   - Collection : `admins`
   - ID du document : `<UID-du-compte>`
   - Champs : `email: "ton.email@..."` , `role: "owner"` , `createdAt: <maintenant en ms>`

Sans ce document, l'app refusera la connexion (c'est ce qui empêche un compte Firebase Auth lambda d'accéder à l'admin).

### 8. Publier les règles Firestore mises à jour

Les règles ont été enrichies pour reconnaître le rôle admin et la collection `adminPushLogs`. Le bloc complet est dans `../README.md` (racine du projet). Copie-le dans Firestore → Rules → *Publier*.

### 9. Lancer le dev

```bash
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000), tu seras redirigé vers `/login`.

---

## Architecture

```
admin/
├── src/
│   ├── app/
│   │   ├── login/page.tsx              ← page de connexion
│   │   ├── dashboard/
│   │   │   ├── layout.tsx              ← sidebar + AuthGate
│   │   │   ├── page.tsx                ← Dashboard KPIs
│   │   │   ├── salons/
│   │   │   │   ├── page.tsx            ← liste
│   │   │   │   ├── new/page.tsx        ← création
│   │   │   │   └── [id]/page.tsx       ← fiche détail
│   │   │   └── push/page.tsx           ← envoi notifications
│   │   ├── api/
│   │   │   ├── salons/route.ts         ← POST (création)
│   │   │   ├── salons/[id]/route.ts    ← PATCH (régénérer code, désactiver…)
│   │   │   └── push/route.ts           ← POST (envoi Expo Push)
│   │   └── layout.tsx                  ← root layout
│   ├── components/
│   │   ├── ui/                         ← Button, Card, Input (style maison)
│   │   ├── AuthGate.tsx                ← gardien client
│   │   ├── Sidebar.tsx
│   │   ├── KpiCard.tsx
│   │   └── CutsChart.tsx               ← recharts
│   └── lib/
│       ├── firebase-client.ts          ← Web SDK (lecture)
│       ├── firebase-admin.ts           ← Admin SDK (server-only, écritures)
│       ├── auth-client.ts              ← login/logout + adminFetch helper
│       ├── auth-server.ts              ← requireAdmin pour API routes
│       ├── stats.ts                    ← agrégations dashboard
│       ├── expo-push.ts                ← envoi Expo Push (batch 100)
│       ├── slug.ts                     ← génération salonId + code
│       ├── format.ts                   ← formatters FR (date, FCFA)
│       ├── cn.ts                       ← Tailwind class merger
│       └── types.ts                    ← types partagés
```

### Sécurité

- **Lecture client-side** : la sidebar + le dashboard utilisent le Web SDK avec authentification. L'`AuthGate` vérifie en plus que l'UID est présent dans `admins/`.
- **Écritures sensibles** : `createSalon`, `regenerate-code`, `disable`, `enable`, `reset-kiosks`, `send-push` passent **uniquement** par les API routes (`/api/...`). Ces routes valident le **token Firebase + le rôle admin** avant d'utiliser le Admin SDK qui contourne les règles Firestore.
- **Service account** : jamais exposé au client (`server-only` package + variable d'env non préfixée `NEXT_PUBLIC_`).

---

## Déploiement sur Vercel

1. Push le repo (ou juste le sous-dossier `admin/`) sur GitHub.
2. Sur [vercel.com](https://vercel.com) → *New Project* → importe le repo. Si `admin/` est en sous-dossier, mets-le comme **Root Directory**.
3. *Environment Variables* → ajoute **toutes** les variables de `.env.example` (avec leurs vraies valeurs).
   - **Astuce CLI** : `vercel env add FIREBASE_SERVICE_ACCOUNT_JSON` permet de coller le JSON sans guillemets manuels.
4. Deploy. Le build prend environ 1 minute.

L'URL finale ressemble à `trimya-admin.vercel.app`. Tu peux y attacher un domaine custom (ex. `admin.trimya.app`) depuis les settings Vercel.

---

## Ajouter d'autres admins

Crée un user dans Firebase Auth (Email/Password), puis un doc `admins/{uid}` avec :

```
email: string
role: "owner" | "staff"
createdAt: number
```

Le champ `role` n'est pas encore utilisé (tout admin a tous les droits), mais il est là pour quand tu voudras restreindre certaines actions.

---

## Prochaines évolutions possibles

- **Liste & fiche client** : navigation par client, voir historique de coupes
- **Export CSV** des coupes / clients pour comptabilité
- **Cohort retention** : % de clients qui reviennent à M+1, M+3
- **Gestion des admins** depuis l'interface (au lieu de Firestore manuel)
- **Facturation** des salons si tu monétises la plateforme
- **Cloud Functions** pour des agrégations pré-calculées (collection `stats/daily`) — utile au-delà de 50+ salons
