Voici un **cahier des charges prêt à copier-coller dans Claude Code**. Il est conçu pour que l’outil développe une première version complète, évolutive et sécurisée, sans déployer quoi que ce soit ni activer de service payant sans votre validation.

# Cahier des charges — Plateforme de pages commémoratives avec QR codes

## 1. Contexte et objectif

Développer une application web permettant à une entreprise de créer, gérer et publier des **pages commémoratives** associées à des **QR codes permanents**.

Les employés authentifiés créent les fiches des défunts, ajoutent les médias et publient les pages. Les familles et visiteurs accèdent à la page publique via un QR code, sans créer de compte, afin de consulter les informations autorisées, déposer des messages de condoléances et allumer des bougies numériques.

Le projet doit être développé **progressivement**, avec un code propre, testable, documenté et facilement modifiable. Aucun déploiement public, aucun achat de service, aucune clé API payante et aucune modification destructive ne doivent être effectués sans validation explicite de l’utilisateur.

## 2. Principes de développement obligatoires

- Travailler par petites étapes validables ; après chaque étape, expliquer ce qui a été réalisé, les fichiers créés ou modifiés, et la prochaine étape.
- Ne jamais écraser, supprimer ou réécrire massivement du code existant sans demander confirmation.
- Séparer strictement les données **publiques** (visibles via QR code) et les données **privées** (accessibles uniquement aux administrateurs et employés autorisés).
- Mettre en place une architecture modulaire : routes, composants, services, modèles de données, validations et tests séparés.
- Utiliser des variables d’environnement pour les secrets ; ne jamais les stocker dans le code, les commits ou les fichiers publics.
- Prévoir une protection des données personnelles et sensibles : validation des entrées, limitation des requêtes, hachage des mots de passe, contrôle d’accès par rôle, journalisation minimale.
- Ne pas intégrer de service payant, de paiement, d’envoi d’e-mails réels, de stockage cloud ou de déploiement sans autorisation préalable.
- Prévoir des valeurs de remplacement locales (mocks, stockage local ou SQLite en développement) si un service externe n’est pas encore autorisé.
- Écrire des tests pour les fonctionnalités critiques : authentification, création de fiche, publication, QR code, modération et accès aux données.
- Fournir un `README.md` clair : installation, variables d’environnement, commandes, structure du projet et instructions de test.

## 3. Utilisateurs et rôles

| Rôle | Accès principal | Peut faire |
|---|---|---|
| Administrateur | Back-office complet | Gérer les employés, les familles, les fiches, les paramètres, la modération, les sauvegardes et les statistiques |
| Employé | Back-office limité | Créer et modifier les fiches défunts, gérer les médias, générer les QR codes, publier ou dépublier selon ses permissions |
| Famille / proche autorisé | Espace éventuel sans compte ou avec accès restreint | Consulter la fiche autorisée, proposer des corrections ou contenus, selon les règles définies |
| Visiteur public | Page publique via QR code | Consulter la page publiée, déposer un message de condoléances, allumer une bougie numérique |

Dans la première version, les rôles obligatoires sont : **administrateur**, **employé** et **visiteur public**. Le rôle « famille » peut être ajouté plus tard sans casser l’architecture.

## 4. Fonctionnalités principales

### 4.1 Authentification et gestion des comptes

- Page de connexion sécurisée pour l’administrateur et les employés.
- Mots de passe hachés avec un algorithme moderne, par exemple bcrypt ou Argon2.
- Sessions sécurisées avec cookies httpOnly, SameSite et expiration.
- Gestion des rôles et permissions.
- L’administrateur peut créer, désactiver ou supprimer un compte employé.
- L’employé ne peut accéder qu’aux fiches et fonctions autorisées.
- Journal d’activité minimal : connexion, création, modification, publication, suppression et modération.

### 4.2 Gestion des familles

L’administrateur ou un employé autorisé doit pouvoir créer une fiche famille contenant au minimum :

- Nom de la famille.
- Contact principal : nom, téléphone, e-mail.
- Adresse éventuelle.
- Notes internes, visibles uniquement par l’administrateur et les employés autorisés.
- Statut : active, inactive, archivée.
- Historique des modifications.

Une famille peut être liée à une ou plusieurs fiches de défunts.

### 4.3 Fiche défunt

L’employé doit pouvoir créer une fiche défunt avec :

- Nom complet.
- Dates de naissance et de décès.
- Photo principale.
- Biographie ou texte de présentation.
- Informations sur la cérémonie : date, heure, lieu, adresse, éventuel lien de diffusion en direct.
- Informations pratiques : fleurs, dons, condoléances, contact familial, consignes particulières.
- Statut de la fiche : brouillon, en attente de validation, publiée, archivée, supprimée.
- Famille associée.
- Employé ayant créé et modifié la fiche.
- Date de création et date de dernière modification.

La page publique ne doit afficher que les champs explicitement marqués comme publics. Les notes internes, coordonnées privées et informations administratives ne doivent jamais apparaître sur la page publique.

### 4.4 Publication et QR code

- Chaque fiche défunt possède une URL publique unique et stable, par exemple : `https://exemple.com/memoire/identifiant-securise`.
- L’identifiant doit être long, aléatoire et non prévisible, afin d’éviter le balayage massif des pages.
- Le QR code doit toujours pointer vers la même URL publique, même si le contenu de la page change.
- Génération et téléchargement du QR code en PNG et SVG.
- Possibilité d’imprimer le QR code avec le nom du défunt et éventuellement le logo de l’entreprise.
- Une fiche ne peut être consultée publiquement que si son statut est « publiée ».
- L’administrateur peut dépublier une page immédiatement ; le QR code doit alors afficher une page sobre indiquant que la page n’est plus disponible, sans exposer de données sensibles.

### 4.5 Médias

L’employé doit pouvoir ajouter à une fiche :

- Photos.
- Vidéos.
- Documents PDF, si nécessaire.
- Galerie d’images.
- Légendes et ordre d’affichage.

Contraintes de sécurité :

- Vérifier le type de fichier, la taille et l’extension réelle.
- Limiter la taille des fichiers.
- Générer des versions optimisées pour le web.
- Ne jamais exécuter de fichier téléversé.
- Stocker les fichiers dans un dossier protégé ou un service de stockage à configurer plus tard.
- Prévoir une suppression logique des médias, avec possibilité de restauration par l’administrateur.

### 4.6 Messages de condoléances

Sur la page publique, un visiteur peut déposer un message de condoléances avec :

- Nom ou prénom.
- Message.
- Coordonnées facultatives.
- Case de consentement à la publication du message.

Règles :

- Les messages ne sont pas publiés automatiquement : ils passent d’abord en modération.
- L’administrateur ou l’employé autorisé peut approuver, refuser, masquer ou supprimer un message.
- Les messages approuvés apparaissent sur la page publique.
- Protection anti-spam : limitation du nombre de soumissions par adresse IP, validation des champs, détection basique de contenus interdits.
- Ne jamais afficher publiquement l’e-mail ou le téléphone d’un visiteur sans autorisation explicite.

### 4.7 Bougies numériques

- Le visiteur peut allumer une bougie numérique pour le défunt.
- La bougie peut être anonyme ou associée à un prénom facultatif.
- Possibilité d’ajouter un court message facultatif.
- Affichage du nombre total de bougies allumées.
- Possibilité de voir les bougies récentes, avec modération si nécessaire.
- Protection contre les soumissions automatiques et les doublons excessifs.

### 4.8 Tableau de bord administrateur

Le back-office doit inclure un tableau de bord avec :

- Nombre de familles.
- Nombre de fiches défunts.
- Nombre de fiches publiées, en brouillon et archivées.
- Nombre de messages en attente de modération.
- Nombre de bougies allumées.
- Activité récente.
- Recherche et filtres par nom, famille, statut et date.
- Export CSV des données non sensibles, à activer uniquement avec autorisation.

## 5. Pages à développer

### Espace public

- Page d’accueil simple et sobre.
- Page commémorative publique accessible par QR code.
- Formulaire de message de condoléances.
- Section bougies numériques.
- Page d’erreur 404 sobre.
- Page « page non disponible » si la fiche est dépubliée.
- Mentions légales et politique de confidentialité, avec textes provisoires à personnaliser.

### Back-office

- Connexion.
- Tableau de bord.
- Gestion des employés.
- Gestion des familles.
- Liste des fiches défunts.
- Création et édition d’une fiche défunt.
- Gestion des médias.
- Génération et téléchargement du QR code.
- Modération des messages.
- Modération des bougies.
- Paramètres de la plateforme.
- Journal d’activité.
- Profil et changement de mot de passe.

## 6. Architecture technique recommandée

Utiliser une architecture moderne, simple et maintenable :

- **Front-end et back-end** : Next.js avec App Router, TypeScript et React.
- **Base de données** : PostgreSQL en production ; SQLite ou PostgreSQL local pour le développement.
- **ORM** : Prisma ou Drizzle ORM.
- **Authentification** : solution locale sécurisée, par exemple Auth.js ou une implémentation maison avec sessions sécurisées.
- **Validation** : Zod.
- **Styles** : Tailwind CSS.
- **Composants UI** : shadcn/ui ou équivalent, avec une interface sobre, élégante et respectueuse du contexte funéraire.
- **QR code** : bibliothèque open source générant PNG et SVG.
- **Tests** : Vitest ou Jest pour les tests unitaires, Playwright pour les tests de parcours critiques.
- **Gestion des erreurs** : pages d’erreur claires, journalisation des erreurs côté serveur, messages utilisateur compréhensibles.

Claude Code doit proposer cette architecture avant de commencer, puis attendre validation avant de créer les fichiers.

## 7. Modèle de données initial

Créer au minimum les tables suivantes :

- `users` : id, nom, e-mail, mot de passe haché, rôle, actif, date de création.
- `families` : id, nom, contact principal, téléphone, e-mail, adresse, notes internes, statut, dates.
- `deceased_profiles` : id, famille_id, nom complet, dates, biographie, photo principale, informations de cérémonie, statut, URL publique, identifiant public, employé créateur, dates.
- `media` : id, fiche_defunt_id, type, chemin ou URL, légende, ordre, statut, dates.
- `condolence_messages` : id, fiche_defunt_id, nom, message, e-mail facultatif, statut de modération, date.
- `candles` : id, fiche_defunt_id, prénom facultatif, message facultatif, statut, date.
- `activity_logs` : id, utilisateur_id, action, entité concernée, détails, adresse IP hachée ou tronquée, date.
- `settings` : clés-valeurs pour le nom de l’entreprise, logo, couleurs, textes, règles de modération et paramètres techniques.

Ne pas stocker de données bancaires, de pièces d’identité ou de données de santé dans la première version.

## 8. Sécurité et confidentialité

- Toutes les routes d’administration doivent être protégées par authentification et contrôle de rôle.
- Les API doivent valider les entrées côté serveur, jamais uniquement côté navigateur.
- Les identifiants publics doivent être différents des identifiants internes de base de données.
- Les fichiers téléversés doivent être vérifiés et servis avec des en-têtes de sécurité appropriés.
- Mettre en place une protection contre les attaques par force brute sur la connexion.
- Mettre en place une limitation du nombre de requêtes sur les formulaires publics.
- Ne pas afficher d’informations privées dans le code HTML, les métadonnées, les URLs ou les réponses API publiques.
- Prévoir une politique de conservation et de suppression des données, notamment pour les messages et médias.
- Les traitements de données personnelles doivent être documentés ; les données sensibles doivent être limitées au strict nécessaire. Les pratiques de confidentialité doivent distinguer clairement les données fournies volontairement, les données techniques et les finalités de traitement. [perplexity](https://www.perplexity.ai/fr/hub/legal/privacy-notice)

## 9. Design et expérience utilisateur

Le design doit être :

- Sobre, élégant, respectueux et rassurant.
- Adapté au mobile, car les QR codes seront principalement scannés depuis un téléphone.
- Rapide à charger.
- Accessible : contrastes suffisants, textes lisibles, navigation claire, formulaires simples.
- Sans publicité, sans pop-ups agressifs et sans contenu commercial sur les pages commémoratives.
- Personnalisable : logo, couleur principale, nom de l’entreprise, textes d’accueil et pied de page.

La page publique doit mettre en avant, dans cet ordre :

1. Photo et nom du défunt.
2. Dates importantes.
3. Message ou biographie.
4. Informations sur la cérémonie.
5. Galerie de souvenirs.
6. Messages de condoléances.
7. Bougies numériques.

## 10. Plan de développement par phases

### Phase 1 — Fondations

- Initialiser le projet Next.js + TypeScript.
- Mettre en place PostgreSQL ou SQLite en local.
- Créer les modèles de données et migrations.
- Mettre en place l’authentification et les rôles.
- Créer le back-office minimal.
- Créer les pages de connexion et de tableau de bord.

### Phase 2 — Gestion des familles et fiches

- CRUD familles.
- CRUD fiches défunts.
- Validation des formulaires.
- Statuts de fiche : brouillon, publié, archivé.
- Recherche, filtres et pagination.

### Phase 3 — QR codes et page publique

- Génération d’une URL publique stable.
- Génération et téléchargement du QR code.
- Création de la page commémorative publique.
- Contrôle du statut de publication.
- Page sobre si la fiche est dépubliée.

### Phase 4 — Médias

- Téléversement sécurisé des photos et vidéos.
- Galerie d’images.
- Ordre d’affichage et légendes.
- Suppression logique et restauration.

### Phase 5 — Condoléances et bougies

- Formulaire public de condoléances.
- File de modération.
- Bougies numériques.
- Protection anti-spam.
- Statistiques simples.

### Phase 6 — Administration avancée

- Gestion des employés.
- Journal d’activité.
- Paramètres de personnalisation.
- Sauvegarde et export de données.
- Tests de sécurité et de parcours utilisateurs.

## 11. Livrables attendus

À la fin de la première version, Claude Code doit livrer :

- Un projet Next.js complet et exécutable en local.
- Une base de données initialisée avec migrations.
- Un compte administrateur de test.
- Un compte employé de test.
- Des fiches de démonstration, clairement identifiées comme exemples.
- Un QR code fonctionnel pointant vers une page publique de démonstration.
- Un `README.md` détaillé.
- Des tests pour les fonctions critiques.
- Une liste des fonctionnalités terminées, des fonctionnalités restantes et des décisions techniques à valider.

## 12. Consigne initiale pour Claude Code

> Développe une plateforme web de pages commémoratives avec QR codes permanents, en suivant strictement ce cahier des charges.  
>  
> Commence par me présenter un plan de développement en phases, la structure de dossiers proposée, les modèles de données et les choix techniques. Attends ma validation avant de créer le projet.  
>  
> Développe ensuite phase par phase, sans supprimer ni réécrire massivement du code existant. Sépare strictement les données publiques et privées. Implémente l’authentification, les rôles administrateur/employé, la gestion des familles, des fiches défunts, des médias, des QR codes, des messages de condoléances et des bougies numériques.  
>  
> N’active aucun service payant, n’effectue aucun déploiement public et n’ajoute aucune clé API sans mon accord explicite. Utilise des solutions locales ou des mocks lorsque nécessaire. Écris du code propre, typé, documenté et testé. À la fin de chaque phase, explique ce qui a été fait, les fichiers modifiés, les tests à lancer et la prochaine étape.  
>  
> La première priorité est une version fonctionnelle en local : administrateur, employé, création de fiche, publication, QR code et page publique consultable depuis un téléphone. Les fonctionnalités secondaires peuvent être préparées mais non finalisées.

## 13. Points à valider avant le développement

Vous pourrez répondre à ces questions plus tard, mais elles ne doivent pas bloquer la première version :

- Nom de la plateforme.
- Nom de l’entreprise et logo.
- Langues à prévoir : français uniquement au départ, ou français + autres langues.
- Pays de déploiement futur, pour adapter les règles de confidentialité.
- Hébergement envisagé : VPS, cloud, serveur local ou autre.
- Stockage des médias : local au début, puis service cloud éventuellement.
- Règles précises de modération des messages.
- Besoin d’un espace famille avec connexion ou non.
- Besoin futur de paiements, dons, fleurs ou services associés.

Les conditions d’utilisation et l’avis de confidentialité fournis concernent les services Perplexity eux-mêmes ; ils ne constituent pas les mentions légales de votre future plateforme, mais peuvent servir de modèle pour comprendre les rubriques habituelles à prévoir : données collectées, finalités, partage, sécurité, droits des personnes et conservation. [perplexity](https://www.perplexity.ai/fr/hub/legal/privacy-notice)