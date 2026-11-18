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
| 4 — Médias | Téléversement sécurisé, optimisation, photo principale, galerie, légendes, ordre, corbeille | ✅ Terminée |
| 5 — Condoléances et bougies | Formulaires publics, file de modération, anti-spam, statistiques | ✅ Terminée |
| 6 — Administration avancée | Employés, mot de passe, journal, paramètres, export CSV, sauvegardes, tests de parcours | ✅ Terminée |

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
| `npm run test:e2e` | Tests de parcours dans Chrome (base de test dédiée `data/e2e.db`) |
| `npm run backup` | Crée une sauvegarde (base + médias) |
| `npm run restore` | Liste les sauvegardes ; `npm run restore -- NOM --confirm` restaure (serveur arrêté) |
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
| `BACKUP_DIR` | Dossier des sauvegardes (`./backups`, non versionné, contient des données personnelles) |
| `MEDIA_STORAGE_DIR` | Dossier des médias téléversés (`./uploads`, hors de `public/`, non versionné) |

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
    memoire/[publicId]/  page commémorative publique (accès par QR code) + diffusion des médias autorisés
    api/admin/medias/    téléversement et diffusion des médias pour le back-office
    mentions-legales/    texte provisoire
    confidentialite/     texte provisoire
      moderation/        file de modération (condoléances et bougies)
      employes/          comptes du personnel (création, rôle, désactivation, mot de passe provisoire)
      journal/           journal d'activité filtrable
      parametres/        identité (nom, logo, couleur, textes) et mots interdits
      donnees/           export CSV et sauvegardes
      profil/            changement de son mot de passe
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
    tributes/            condoléances et bougies : dépôt, anti-spam, modération, statistiques
    users/service.ts     comptes et garde-fous (dernier administrateur, sessions)
    settings.ts          paramètres (identité, logo, mots interdits, contraste)
    csv.ts, exports.ts   export CSV non sensible (anti-injection de formules)
    backup.ts            sauvegarde / vérification / restauration
    activity-query.ts    consultation du journal
    media/               détection du type réel, optimisation (sharp), stockage protégé, diffusion, service
    activity-log.ts      journal d'activité
    dashboard.ts         indicateurs du tableau de bord
    branding.ts          paramètres de personnalisation (lecture)
tests/                   tests Vitest (+ base SQLite en mémoire)
e2e/                     tests de parcours Playwright
scripts/backup.ts, restore.ts   sauvegarde et restauration en ligne de commande
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
  Ordre : photo et nom, dates, biographie, cérémonie, informations pratiques,
  galerie, messages de condoléances, bougies.
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

## Médias (Phase 4)

Écran : **Fiche → Gérer les médias** (`/admin/fiches/[id]/medias`).

| Type | Formats | Taille max | Traitement |
|---|---|---|---|
| Photo | JPEG, PNG, WebP | 15 Mo | ré-encodée en WebP, 2000 px max + miniature 640 px, **métadonnées supprimées** (GPS, appareil…) |
| Vidéo | MP4, MOV, WebM | 100 Mo | stockée telle quelle |
| Document | PDF | 10 Mo | stocké tel quel, toujours téléchargé (jamais affiché dans le site) |

Maximum 100 médias actifs par fiche. Le format **HEIC** (photos iPhone) n'est pas
pris en charge : exporter la photo en JPEG (ou régler l'iPhone sur « Le plus compatible »).

- **Photo principale** : une photo de la fiche, toujours affichée en haut de la page publique.
- **Galerie** : médias « visibles publiquement », dans l'ordre choisi (↑ ↓), avec légende.
- **Corbeille** : suppression logique (le fichier est conservé) ; un employé peut
  mettre à la corbeille, seul un administrateur peut restaurer.

**Sécurité des fichiers** :
- type vérifié sur le **contenu réel** (signature), pas sur le nom ; l'extension doit correspondre ;
- photos ré-encodées : un fichier piégé déguisé en image ne survit pas au traitement ;
  images démesurées (« bombes de décompression ») refusées ;
- stockage dans `uploads/`, **hors de `public/`** : aucun fichier n'est servi directement ;
  noms de fichiers aléatoires, chemins contrôlés (pas de `../`), jamais d'écrasement ;
- diffusion par des routes qui vérifient les droits, avec `nosniff`, CSP `sandbox` ;
- **public** : uniquement si la fiche est publiée et le média autorisé (photo principale, ou
  média public avec galerie affichée) ; revalidation à chaque affichage pour qu'une
  dépublication ou un masquage prenne effet immédiatement ;
- téléversement sur `/api/admin/medias` (hors du proxy qui limite les envois à 10 Mo) :
  contrôle d'origine (anti-CSRF), session, permission, taille et type côté serveur.

## Condoléances et bougies (Phase 5)

**Côté visiteur** (page publique, sans compte) :
- *Message de condoléances* : nom, message, coordonnées facultatives (jamais
  affichées), case de consentement obligatoire. **Toujours** relu avant publication.
- *Bougie* : prénom et petit mot facultatifs. Sans mot, elle s'affiche tout de
  suite ; avec un mot, elle passe d'abord en modération. Compteur de bougies affiché.
- Sections masquées si l'option correspondante est désactivée sur la fiche.

**Côté personnel** : menu **Modération** (avec le nombre d'éléments en attente) —
onglets Condoléances / Bougies, filtres par statut et par fiche, actions
**Approuver**, **Refuser**, **Masquer** et **Supprimer** (définitif, efface aussi
les coordonnées). Accessible aux administrateurs et aux employés. Chaque décision
est journalisée. Statistiques par fiche (messages publiés / en attente, bougies)
sur la page de la fiche et sur le tableau de bord.

**Anti-spam** (sans service externe) :
- champ piège invisible : un robot qui le remplit reçoit un faux « merci » et rien n'est enregistré ;
- jeton signé (HMAC) avec l'heure d'affichage : refus des envois en moins de 3 s,
  des pages de plus de 24 h et des jetons falsifiés ;
- refus des liens et d'une courte liste de mots interdits (`src/lib/tributes/spam.ts`) ;
- limites par adresse IP hachée : 3 messages / 10 min et 10 / jour ; 5 bougies / 10 min
  et 1 bougie par fiche et par heure ; plafond de 300 dépôts par fiche et par jour.

> En production derrière un reverse proxy, celui-ci doit transmettre l'IP réelle
> dans `X-Forwarded-For` (et écraser celle envoyée par le client), sinon les
> limites par IP peuvent être contournées.

## Administration avancée (Phase 6)

| Écran | Qui | Contenu |
|---|---|---|
| **Employés** | admin | créer un compte (mot de passe provisoire affiché **une seule fois**, aucun e-mail envoyé), modifier nom et rôle, réinitialiser le mot de passe, désactiver / réactiver, supprimer ; historique du compte |
| **Mon profil** | tous | changer son mot de passe (les autres sessions sont fermées) |
| **Journal** | admin | toute l'activité, filtrable par utilisateur, catégorie et période |
| **Paramètres** | admin | nom de l'entreprise, logo, couleur principale (contraste vérifié), texte d'accueil, pied de page ; liste des mots interdits |
| **Données** | admin | export CSV, création et liste des sauvegardes |

**Garde-fous des comptes** : impossible de se désactiver, se supprimer ou se
retirer le rôle d'administrateur ; il reste toujours au moins un administrateur
actif ; désactivation et réinitialisation ferment immédiatement les sessions.
La suppression d'un compte conserve ses fiches et le journal (auteur « inconnu »).

**Export CSV** (Excel, séparateur `;`) : fiches avec nom, dates, statut, adresse
publique et compteurs. Exclut familles, notes internes, contenu des messages,
coordonnées et identifiants internes. Les cellules commençant par `= + - @`
sont neutralisées (injection de formules). Chaque export est journalisé.

**Sauvegardes** : bouton « Créer une sauvegarde » ou `npm run backup` → dossier
`backups/sauvegarde-AAAAMMJJ-HHMMSS/` (base cohérente via `VACUUM INTO` + médias +
manifeste). **Restauration en ligne de commande uniquement, serveur arrêté** :

```bash
npm run restore                                   # liste
npm run restore -- sauvegarde-20261118-085054 --confirm
npm run db:migrate                                # au cas où la sauvegarde serait plus ancienne
```

La restauration vérifie l'intégrité de la sauvegarde, crée d'abord une
sauvegarde de sécurité de l'état actuel (`…-avant-restauration`) et revient en
arrière en cas d'échec. Les sauvegardes contiennent des données personnelles :
à conserver chiffrées et à copier régulièrement hors de la machine.

## Tests de parcours (Playwright)

```bash
npm run test:e2e
```

Construit l'application, recrée une base de test **dédiée** (`data/e2e.db`, jamais
la base de développement), démarre le serveur sur le port 3100 et rejoue 7
parcours dans le Chrome installé sur la machine : accès refusé sans connexion,
erreur de connexion générique, création famille → fiche → publication → QR code,
visite mobile + message + bougie (sans aucune donnée privée dans le HTML),
modération puis dépublication immédiate, création d'un employé avec mot de passe
provisoire, puis vérification qu'il ne peut accéder ni aux comptes, ni au journal,
ni aux paramètres, ni à l'export.

## Design, thèmes et animations

**Back-office** : thème bleu et blanc — barre latérale bleue (menu coulissant sur
téléphone), tableau de bord avec bandeau d'accueil, raccourcis et indicateurs
animés, cartes et tableaux arrondis, frise d'historique. Polices Inter (texte)
et Cormorant Garamond (titres), auto-hébergées.

**Pages publiques** : l'administrateur choisit le thème que voient les visiteurs
en scannant le QR code :

- **Paramètres → Thème des pages commémoratives** : thème par défaut, avec aperçus ;
  lien « Voir un exemple de page » (`/apercu-theme`, page fictive, administrateurs).
- **Fiche → Thème de la page publique** : thème propre à une fiche (ou « par défaut »).

| Thème | Ambiance |
|---|---|
| Sérénité (défaut) | bleu ciel apaisant et blanc |
| Lavande | mauve doux |
| Sauge | vert naturel |
| Sable doré | beige chaleureux, touches dorées |
| Rose poudré | rose léger |
| Ardoise | gris élégant, très sobre |
| Nuit étoilée | bleu nuit et lueurs dorées (thème sombre, ciel étoilé discret) |

Tous les thèmes respectent les contrastes WCAG AA (vérifiés par les tests). Seul
l'identifiant du thème est stocké : aucune couleur libre n'est injectée dans la page.

**Animations** : apparitions en fondu à l'ouverture et au défilement, halo
autour du portrait, bougies dont la flamme vacille, galerie avec zoom et
visionneuse plein écran (flèches, clavier, glissement du doigt), boutons et
cartes qui réagissent au survol, compteurs animés. Toutes les animations sont
désactivées si l'appareil demande à « réduire les animations ».

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

121 tests unitaires et d'intégration (`npm test`) couvrent :

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
- **Phase 4** : signatures de fichiers (fichier HTML ou exécutable déguisé refusé, HEIC
  signalé), extension incohérente, taille, image corrompue, suppression des métadonnées
  EXIF, redimensionnement, bombe de décompression, sortie du dossier de stockage,
  non-écrasement, requêtes partielles, ordre, légende, visibilité, corbeille et
  restauration, photo principale, règles d'accès public, absence de donnée interne.
- **Phase 5** : jeton anti-robot (délai, expiration, falsification, autre page), liens
  et mots interdits, validation et consentement, dépôt refusé sur fiche non publiée ou
  fermée, mise en attente systématique des messages, bougies directes ou modérées,
  limites par IP et par heure, modération, suppression définitive, statistiques,
  absence de coordonnées et d'IP dans les données publiques et le journal.
- **Phase 6** : mots de passe provisoires, création / réinitialisation / désactivation
  (sessions fermées), garde-fous du dernier administrateur, suppression conservant les
  fiches, changement de son mot de passe, journal filtré, CSV (échappement, injection de
  formules, données exclues), contraste, logo (ré-encodage, remplacement, refus d'un faux
  fichier), mots interdits configurables, sauvegarde + restauration complète, refus d'une
  sauvegarde corrompue sans toucher aux données, noms de sauvegarde dangereux.
- **Thèmes** : contrastes WCAG des 7 thèmes, résolution fiche → paramètres → défaut,
  refus d'identifiants piégés (`constructor`, `__proto__`), compatibilité avec les
  anciens réglages, thème par fiche exposé à la page publique.

Plus 7 tests de parcours Playwright (voir ci-dessus).

## Migration PostgreSQL (plus tard)

Le schéma évite les spécificités SQLite (identifiants UUID en texte, dates gérées
par l'application, énumérations en texte). Pour migrer : passer `dialect` à
`postgresql` dans `drizzle.config.ts`, remplacer `sqliteTable` par `pgTable`
(et les types de colonnes correspondants) dans le schéma, utiliser le pilote
`drizzle-orm/node-postgres`, puis régénérer les migrations.

## Fonctionnalités terminées et restantes

Toutes les phases 1 à 6 du plan sont terminées. Restent hors périmètre de la
première version (à décider) : espace famille avec connexion, envoi d'e-mails réels
(ex. alerte de nouveau message, envoi du mot de passe provisoire), stockage cloud des
médias, compression vidéo, prise en charge du format HEIC, multilingue, déploiement
en ligne (hébergement, nom de domaine, HTTPS, reverse proxy), migration PostgreSQL,
textes juridiques définitifs, politique de conservation des données.

## Décisions à valider

Voir la section 13 du cahier des charges (nom de la plateforme, entreprise, langues,
hébergement, règles de modération, espace famille…). Choix provisoires :
le nom affiché est « Memoria », le français est la seule langue, les médias seront
stockés localement dans un dossier non public.
