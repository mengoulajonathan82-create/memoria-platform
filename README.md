# Memoria — Plateforme de pages commémoratives

Application web permettant à une entreprise de pompes funèbres de créer et publier
des pages commémoratives accessibles par QR code permanent.

- Cahier des charges : [`CAHIER-DES-CHARGES.md`](CAHIER-DES-CHARGES.md)
- Consignes de développement : [`PROMPT_CLAUDE_CODE.md`](PROMPT_CLAUDE_CODE.md)

> Projet **100 % local** : aucun déploiement, aucun service payant, aucune clé
> d'API, aucun envoi d'e-mail réel, aucun stockage cloud.

## État d'avancement

| Phase | Contenu | État |
|---|---|---|
| 1 — Fondations | Next.js, base SQLite + migrations, authentification, rôles, connexion, tableau de bord, comptes de test | ✅ Terminée |
| 2 — Familles et fiches | CRUD, validation, statuts, recherche, filtres, pagination, historique | ✅ Terminée |
| 3 — QR codes et page publique | URL stable, QR PNG/SVG, impression, page publique, dépublication, mentions légales | ✅ Terminée |
| 4 — Médias | Téléversement sécurisé, galerie, corbeille | À venir |
| 5 — Condoléances et bougies | Formulaires publics, modération, anti-spam | À venir |
| 6 — Administration avancée | Employés, paramètres, export CSV, sauvegardes | À venir |

## Prérequis

- Node.js 20.9 ou plus récent (testé avec Node 26) et npm.
- Aucune base de données à installer : SQLite est embarqué (fichier `data/memoria.db`).

## Installation et lancement

```bash
npm install
npm run setup      # crée .env (secrets aléatoires), applique les migrations, crée les comptes de test
npm run dev        # http://localhost:3000
```

`npm run setup` enchaîne :

1. `npm run setup:env` — crée `.env` à partir de `.env.example` en générant un
   secret et deux mots de passe de test aléatoires. **Ne remplace jamais un `.env` existant.**
2. `npm run db:migrate` — applique les migrations SQL de `drizzle/`.
3. `npm run db:seed` — crée le compte administrateur et le compte employé de test
   (idempotent : un compte existant n'est jamais modifié).

### Comptes de test

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Administrateur | `admin@exemple.test` | valeur de `SEED_ADMIN_PASSWORD` dans `.env` |
| Employé | `employe@exemple.test` | valeur de `SEED_EMPLOYEE_PASSWORD` dans `.env` |

Ces comptes sont réservés au développement local (le seed refuse de s'exécuter
avec `NODE_ENV=production`).

### Données de démonstration (facultatif)

```bash
npm run db:seed:demo
```

Crée une famille fictive « Famille Exemple (démonstration) » et deux fiches
fictives (« Jeanne Exemple », publiée, et « Paul Exemple », brouillon), clairement
identifiées comme exemples. Idempotent.

Connexion : <http://localhost:3000/connexion>

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production local |
| `npm run lint` | ESLint |
| `npm run typecheck` | Génération des types de routes + TypeScript |
| `npm test` | Tests unitaires et d'intégration (Vitest, base SQLite en mémoire) |
| `npm run check` | lint + typecheck + tests |
| `npm run db:generate` | Génère une migration après modification de `src/lib/db/schema.ts` |
| `npm run db:migrate` | Applique les migrations |
| `npm run db:seed` | Crée les comptes de test |
| `npm run db:seed:demo` | Crée les données de démonstration |
| `npm run start:lan` | Serveur de production accessible depuis le réseau local (test sur téléphone) |
| `npm run db:studio` | Explorateur visuel de la base (Drizzle Studio) |

Réinitialiser la base locale : supprimer le dossier `data/` puis `npm run db:setup`.

## Variables d'environnement

Voir [`.env.example`](.env.example). Le fichier `.env` n'est **jamais** versionné.

| Variable | Description |
|---|---|
| `DATABASE_URL` | URL de la base (`file:./data/memoria.db` en local) |
| `APP_URL` | URL publique de l'application (servira aux QR codes) |
| `SESSION_TTL_HOURS` | Durée de vie d'une session du back-office (8 h par défaut) |
| `IP_HASH_SECRET` | Secret pour hacher les adresses IP (≥ 32 caractères) |
| `SEED_*` | Nom, e-mail et mot de passe des comptes de test |

## Stack technique

| Besoin | Choix | Raison |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict | Demandé ; front et back dans un seul projet |
| Styles | Tailwind CSS 4 | Demandé ; jetons de couleur dans `globals.css` |
| ORM | **Drizzle ORM** + `@libsql/client` | Léger, typé, sans génération de code ; migrations SQL lisibles ; pilote natif compatible Node 26 sans compilation |
| Base | SQLite en local | Migration PostgreSQL prévue (voir plus bas) |
| Validation | Zod 4 | Validation côté serveur de toutes les entrées |
| Mots de passe | Argon2id (`@node-rs/argon2`, paramètres OWASP) | Algorithme recommandé |
| Sessions | Implémentation maison, en base | Pas de dépendance externe ni de secret de chiffrement ; révocation immédiate possible |
| Tests | Vitest | Rapide, compatible TypeScript |

`cacheComponents` (nouveau modèle de cache de Next.js 16) est **désactivé** : le
back-office lit la session à chaque requête et affiche des données vivantes ; le
rendu dynamique classique y est plus simple et plus sûr.

## Structure du projet

```
drizzle/                 migrations SQL générées (versionnées)
scripts/
  setup-env.ts           création du .env local avec secrets aléatoires
  migrate.ts             application des migrations
  seed.ts                comptes de test + paramètres par défaut
  seed-demo.ts           données de démonstration fictives
src/
  proxy.ts               redirection optimiste vers /connexion (ex-« middleware »)
  app/
    page.tsx             accueil public
    not-found.tsx        404 sobre
    connexion/           page, formulaire et Server Action de connexion
    admin/               back-office (protégé)
      layout.tsx         garde d'authentification + navigation filtrée par rôle
      page.tsx           tableau de bord
      familles/          liste, création, détail, modification, suppression
      fiches/            liste, création, détail, modification, statuts, QR (PNG/SVG/impression)
    memoire/[publicId]/  page commémorative publique (accès par QR code)
    mentions-legales/    texte provisoire
    confidentialite/     texte provisoire
      employes/          liste des comptes (administrateur uniquement)
      acces-refuse/      page « accès refusé »
      actions.ts         déconnexion
  lib/
    env.ts               validation des variables d'environnement
    db/schema.ts         modèle de données complet
    db/client.ts         fabrique de connexion (scripts, tests)
    db/index.ts          connexion partagée (serveur uniquement)
    auth/
      dal.ts             couche d'accès : getCurrentUser, requireUser, requirePermission, cookie
      session-service.ts création / validation / révocation des sessions
      login-service.ts   authentification + anti force brute
      password.ts        Argon2id
      permissions.ts     rôles → permissions
    security/crypto.ts   jetons, identifiants publics, hachage d'IP
    validation/          schémas Zod (connexion, familles, fiches, champs communs)
    families/service.ts  familles : liste, création, modification, suppression
    profiles/service.ts  fiches : liste, création, modification, statuts, suppression logique
    history.ts           historique d'une entité (depuis le journal)
    query-utils.ts       pagination, recherche, diff de champs
    profiles/public.ts   lecture publique en liste blanche
    qr.ts                URL publique et génération des QR codes
    activity-log.ts      journal d'activité
    dashboard.ts         indicateurs du tableau de bord
    branding.ts          paramètres de personnalisation (lecture)
tests/                   tests Vitest (+ base SQLite en mémoire)
```

## Modèle de données

Défini dans [`src/lib/db/schema.ts`](src/lib/db/schema.ts) — 10 tables :

| Table | Contenu | Visibilité |
|---|---|---|
| `users` | nom, e-mail, hachage du mot de passe, rôle, actif | privé |
| `sessions` | empreinte du jeton, utilisateur, expiration | privé |
| `login_attempts` | tentatives de connexion (anti force brute) | privé |
| `families` | nom, contact, adresse, notes internes, statut | **entièrement privé** |
| `deceased_profiles` | identité, dates, biographie, cérémonie, infos pratiques, interrupteurs de visibilité par champ, `public_id`, notes internes, statut | mixte (liste blanche de champs publics) |
| `media` | fichier, type, légende, ordre, public/privé, suppression logique | mixte |
| `condolence_messages` | nom, message, e-mail/téléphone (privés), consentement, statut de modération, IP hachée | mixte |
| `candles` | prénom et message facultatifs, statut de modération, IP hachée | mixte |
| `activity_logs` | utilisateur, action, entité, détails non sensibles, IP hachée | privé |
| `settings` | clé → valeur JSON (personnalisation, règles) | privé (sauf rendu de la marque) |

Statuts d'une fiche : `draft`, `pending`, `published`, `archived`, `deleted`.
Statuts de modération : `pending`, `approved`, `rejected`, `hidden`.

## Familles et fiches (Phase 2)

| Écran | Adresse |
|---|---|
| Liste des familles (recherche nom/contact, filtre statut, pagination) | `/admin/familles` |
| Fiche famille (contact privé, fiches rattachées, historique) | `/admin/familles/[id]` |
| Liste des fiches (recherche nom, filtres statut / famille / période de décès, pagination) | `/admin/fiches` |
| Fiche défunt (contenu, visibilité publique, publication, historique) | `/admin/fiches/[id]` |

**Statuts d'une fiche** : brouillon → en attente de validation → publiée → archivée.
Une fiche est toujours créée en brouillon. « Supprimée » est une suppression
logique (la fiche reste en base) ; un administrateur peut la restaurer, elle
revient alors en brouillon, jamais directement publiée.

**Visibilité publique champ par champ** : dates, biographie, cérémonie,
informations pratiques, galerie, condoléances et bougies peuvent être masquées
individuellement. Les notes internes et toutes les données des familles sont
toujours privées.

**Droits** :

| Action | Administrateur | Employé |
|---|---|---|
| Créer / modifier familles et fiches | ✅ | ✅ |
| Publier, dépublier, archiver une fiche | ✅ | ✅ |
| Supprimer une fiche (logique) / la restaurer | ✅ | ❌ |
| Supprimer une famille (seulement sans fiche rattachée) | ✅ | ❌ |

**Historique** : chaque création, modification, changement de statut,
suppression et restauration est journalisé avec l'auteur et la date. Pour les
modifications, seuls les **noms** des champs modifiés sont enregistrés, jamais
leurs valeurs (pas de données privées dans le journal).

## QR codes et page publique (Phase 3)

- **URL publique** : `APP_URL/memoire/<identifiant public>`. Elle est créée avec
  la fiche et ne change jamais, même si le contenu est modifié, dépublié puis
  republié. Elle ne contient aucun identifiant interne.
- **QR code** : visible sur la fiche dans le back-office, téléchargeable en
  **PNG** (1024 px, pour l'impression) et **SVG** (vectoriel), et page
  **Imprimer** (nom de l'entreprise, nom et dates du défunt, QR code, adresse).
  Généré localement par la bibliothèque open source `qrcode`, sans service externe.
- **Page publique** (`/memoire/...`) : responsive, sobre, sans publicité.
  Ordre : nom (photo en Phase 4), dates, biographie, cérémonie, informations
  pratiques ; galerie (Phase 4), condoléances et bougies (Phase 5) à venir.
- **Statut** : seule une fiche « publiée » est affichée. Brouillon, en attente,
  archivée ou supprimée → page « Cette page n'est plus disponible », sans aucune
  donnée (pas même le nom). Identifiant inconnu → 404. Effet immédiat.
- **Confidentialité** : la requête publique lit une **liste blanche** de colonnes
  et remplace les champs masqués par `null` avant le rendu. Notes internes,
  famille, coordonnées et identifiants internes ne peuvent pas atteindre le HTML.
- `/mentions-legales` et `/confidentialite` : **textes provisoires** à
  personnaliser et faire valider avant toute mise en ligne.

### Tester sur un téléphone (même réseau Wi-Fi)

Par défaut `APP_URL=http://localhost:3000` : un téléphone qui scanne le QR code
ne peut pas joindre « localhost » (le back-office l'indique par un avertissement).

1. Trouver l'adresse IP locale de l'ordinateur : `ipconfig` (ligne « Adresse IPv4 »,
   par ex. `192.168.1.20`).
2. Dans `.env`, mettre `APP_URL=http://192.168.1.20:3000`.
3. Lancer la version de production accessible sur le réseau local :
   ```bash
   npm run build
   npm run start:lan
   ```
   Windows peut demander d'autoriser Node.js dans le pare-feu (réseau **privé** uniquement).
4. Scanner le QR code d'une fiche **publiée** avec le téléphone.

Rien n'est exposé sur Internet : seul le réseau local y a accès, tant que le serveur tourne.

## Sécurité mise en place (Phase 1)

- **Mots de passe** hachés en Argon2id ; jamais stockés ni journalisés en clair.
- **Sessions** : jeton aléatoire de 256 bits dans un cookie `httpOnly`, `SameSite=Lax`,
  `Secure` en production (préfixe `__Host-`) ; seule l'empreinte SHA-256 est en base ;
  expiration absolue ; session invalidée si le compte est désactivé.
- **Force brute** : 5 échecs par e-mail ou 20 échecs par IP en 15 minutes → blocage
  temporaire ; message d'erreur générique ; temps de réponse constant même si
  l'e-mail n'existe pas.
- **Contrôle d'accès** : vérifié côté serveur dans chaque page et action
  (`requireUser` / `requirePermission`) ; le proxy ne fait qu'une redirection optimiste.
- **IP** : jamais stockées en clair (HMAC-SHA256 tronqué).
- **Identifiants publics** des fiches : 32 caractères aléatoires (~186 bits),
  distincts des identifiants internes ; seuls utilisés dans les URL publiques et QR codes.
- **En-têtes** : `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy` ; pages non indexées par les moteurs de recherche.
- Server Actions protégées contre le CSRF par la vérification d'origine de Next.js.

## Tests

```bash
npm test
```

61 tests couvrent :

- **Phase 1** : hachage et vérification des mots de passe, politique de mot de
  passe, identifiants publics, jetons et hachage d'IP, matrice des permissions,
  validation de la connexion, cycle de vie des sessions, protection contre la
  force brute.
- **Phase 2** : validation des formulaires (dates, heures, URL `javascript:`
  refusées, e-mail, téléphone), pagination, recherche insensible à la casse et
  jokers `%`/`_` traités comme du texte, filtres, création / modification /
  suppression des familles, identifiant public stable et unique, transitions de
  statut et date de publication, suppression logique et restauration, absence
  de valeurs privées dans le journal.
- **Phase 3** : accès public selon le statut (publiée / indisponible /
  introuvable, effet immédiat de la dépublication), URL stable après
  modification, liste blanche exacte des champs publics, absence de toute donnée
  privée, champs masqués à `null`, URL publique, **décodage réel du QR code PNG**
  (il contient exactement l'URL publique), SVG sans script, noms de fichiers sûrs.

## Migration PostgreSQL (plus tard)

Le schéma évite les spécificités SQLite (identifiants UUID en texte, dates gérées
par l'application, énumérations en texte). Pour migrer : passer `dialect` à
`postgresql` dans `drizzle.config.ts`, remplacer `sqliteTable` par `pgTable`
(et les types de colonnes correspondants) dans le schéma, utiliser le pilote
`drizzle-orm/node-postgres`, puis régénérer les migrations.

## Décisions à valider

Voir la section 13 du cahier des charges (nom de la plateforme, entreprise, langues,
hébergement, règles de modération, espace famille…). Choix provisoires :
le nom affiché est « Memoria », le français est la seule langue, les médias seront
stockés localement dans un dossier non public.
