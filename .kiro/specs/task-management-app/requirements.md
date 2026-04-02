# Document de Requirements

## Introduction

Application web de gestion des tâches de style Kanban, développée en Next.js fullstack. Elle permet aux utilisateurs d'organiser leur travail sous forme de tableaux, colonnes et cartes. L'application supporte l'authentification via email ou compte Google (OAuth), la gestion de pièces jointes via MinIO, et respecte l'approche Progressive Web App (PWA). L'infrastructure repose sur Docker Compose avec MySQL et MinIO, et l'ORM utilisé est Drizzle avec des entités définies dans des fichiers séparés.

## Glossaire

- **Application** : l'application Next.js fullstack de gestion des tâches
- **Utilisateur** : personne authentifiée utilisant l'application
- **Tableau** : espace de travail Kanban contenant des colonnes
- **Colonne** : subdivision d'un tableau regroupant des cartes (ex. : "À faire", "En cours", "Terminé")
- **Carte** : unité de travail représentant une tâche, placée dans une colonne
- **Pièce_Jointe** : fichier attaché à une carte, stocké dans MinIO
- **Authentificateur** : module gérant l'inscription, la connexion et les sessions
- **OAuth** : protocole d'autorisation permettant la connexion via un fournisseur tiers (Google)
- **MinIO** : service de stockage d'objets compatible S3, utilisé pour les pièces jointes
- **Drizzle** : ORM TypeScript utilisé pour interagir avec la base de données MySQL
- **MySQL** : système de gestion de base de données relationnelle utilisé en production
- **Docker_Compose** : outil d'orchestration de conteneurs pour l'infrastructure locale (MySQL + MinIO)
- **PWA** : Progressive Web App, application web installable offrant une expérience proche du natif
- **Service_Worker** : script s'exécutant en arrière-plan pour le cache offline et les notifications
- **ShadCN** : bibliothèque de composants UI utilisée pour l'interface
- **Validateur** : module de validation des données en entrée

## Requirements

### Requirement 1 : Authentification par email

**User Story :** En tant qu'utilisateur, je veux m'inscrire et me connecter avec mon adresse email et un mot de passe, afin d'accéder à mon espace de travail de manière sécurisée.

#### Critères d'acceptation

1. WHEN un visiteur soumet un formulaire d'inscription avec un email valide et un mot de passe, THE Authentificateur SHALL créer un compte utilisateur et démarrer une session authentifiée
2. WHEN un visiteur soumet un formulaire de connexion avec des identifiants valides, THE Authentificateur SHALL démarrer une session authentifiée et rediriger vers le tableau de bord
3. IF un visiteur soumet un formulaire de connexion avec des identifiants invalides, THEN THE Authentificateur SHALL retourner un message d'erreur générique sans préciser lequel des deux champs est incorrect
4. IF un visiteur tente de s'inscrire avec un email déjà utilisé, THEN THE Authentificateur SHALL retourner un message d'erreur indiquant que l'email est déjà associé à un compte
5. THE Authentificateur SHALL stocker les mots de passe sous forme hachée en utilisant un algorithme sécurisé (bcrypt ou argon2)
6. WHEN un utilisateur authentifié se déconnecte, THE Authentificateur SHALL invalider la session et rediriger vers la page de connexion

---

### Requirement 2 : Authentification via Google OAuth

**User Story :** En tant qu'utilisateur, je veux me connecter avec mon compte Google, afin de m'authentifier sans créer de mot de passe supplémentaire.

#### Critères d'acceptation

1. WHEN un visiteur clique sur "Connexion avec Google", THE Authentificateur SHALL initier le flux OAuth avec le fournisseur Google
2. WHEN Google retourne une autorisation valide, THE Authentificateur SHALL créer ou associer un compte utilisateur et démarrer une session authentifiée
3. IF Google retourne une erreur ou un refus d'autorisation, THEN THE Authentificateur SHALL afficher un message d'erreur et rediriger vers la page de connexion
4. THE Authentificateur SHALL associer un compte Google à un compte email existant si l'adresse email correspond

---

### Requirement 3 : Gestion des tableaux

**User Story :** En tant qu'utilisateur, je veux créer et gérer des tableaux Kanban, afin d'organiser mes projets de manière indépendante.

#### Critères d'acceptation

1. WHEN un utilisateur authentifié crée un tableau avec un nom valide, THE Application SHALL persister le tableau en base de données MySQL via Drizzle et l'afficher dans la liste des tableaux
2. WHEN un utilisateur authentifié renomme un tableau, THE Application SHALL mettre à jour le nom en base de données et refléter le changement dans l'interface
3. WHEN un utilisateur authentifié supprime un tableau, THE Application SHALL supprimer le tableau ainsi que toutes ses colonnes et cartes associées
4. THE Application SHALL afficher uniquement les tableaux appartenant à l'utilisateur authentifié
5. IF un utilisateur tente d'accéder à un tableau qui ne lui appartient pas, THEN THE Application SHALL retourner une erreur 403

---

### Requirement 4 : Gestion des colonnes

**User Story :** En tant qu'utilisateur, je veux ajouter et organiser des colonnes dans un tableau, afin de structurer les étapes de mon flux de travail.

#### Critères d'acceptation

1. WHEN un utilisateur authentifié ajoute une colonne à un tableau, THE Application SHALL persister la colonne avec son ordre d'affichage en base de données MySQL via Drizzle
2. WHEN un utilisateur authentifié réordonne les colonnes par glisser-déposer, THE Application SHALL mettre à jour l'ordre de toutes les colonnes affectées en base de données
3. WHEN un utilisateur authentifié renomme une colonne, THE Application SHALL mettre à jour le nom en base de données
4. WHEN un utilisateur authentifié supprime une colonne, THE Application SHALL supprimer la colonne et toutes les cartes qu'elle contient
5. THE Application SHALL conserver l'ordre des colonnes tel que défini par l'utilisateur lors de chaque chargement du tableau

---

### Requirement 5 : Gestion des cartes

**User Story :** En tant qu'utilisateur, je veux créer et gérer des cartes dans les colonnes, afin de suivre l'avancement de chaque tâche.

#### Critères d'acceptation

1. WHEN un utilisateur authentifié crée une carte dans une colonne, THE Application SHALL persister la carte avec un titre, une description optionnelle et un ordre d'affichage en base de données MySQL via Drizzle
2. WHEN un utilisateur authentifié déplace une carte vers une autre colonne, THE Application SHALL mettre à jour la colonne et l'ordre de la carte en base de données
3. WHEN un utilisateur authentifié modifie le titre ou la description d'une carte, THE Application SHALL persister les modifications en base de données
4. WHEN un utilisateur authentifié supprime une carte, THE Application SHALL supprimer la carte et toutes ses pièces jointes associées dans MinIO
5. THE Application SHALL afficher les cartes dans l'ordre défini par l'utilisateur au sein de chaque colonne

---

### Requirement 6 : Pièces jointes sur les cartes

**User Story :** En tant qu'utilisateur, je veux joindre des fichiers à mes cartes, afin de centraliser les documents liés à une tâche.

#### Critères d'acceptation

1. WHEN un utilisateur authentifié téléverse un fichier sur une carte, THE Application SHALL stocker le fichier dans MinIO et persister les métadonnées (nom, taille, type MIME, URL) en base de données MySQL via Drizzle
2. WHEN un utilisateur authentifié télécharge une pièce jointe, THE Application SHALL générer une URL signée temporaire depuis MinIO et rediriger l'utilisateur vers cette URL
3. WHEN un utilisateur authentifié supprime une pièce jointe, THE Application SHALL supprimer le fichier dans MinIO et les métadonnées en base de données
4. IF le fichier téléversé dépasse 20 Mo, THEN THE Application SHALL rejeter la requête et retourner un message d'erreur indiquant la limite de taille
5. THE Application SHALL afficher la liste des pièces jointes d'une carte avec leur nom, taille et date d'ajout
6. IF MinIO est indisponible lors d'un téléversement, THEN THE Application SHALL retourner un message d'erreur et ne pas persister de métadonnées orphelines en base de données

---

### Requirement 7 : Interface utilisateur avec ShadCN

**User Story :** En tant qu'utilisateur, je veux une interface claire et cohérente, afin de naviguer efficacement dans l'application.

#### Critères d'acceptation

1. THE Application SHALL utiliser les composants ShadCN pour l'ensemble des éléments d'interface (boutons, formulaires, modales, menus)
2. THE Application SHALL afficher un retour visuel immédiat lors des opérations de glisser-déposer sur les cartes et colonnes
3. WHEN une opération asynchrone est en cours, THE Application SHALL afficher un indicateur de chargement
4. IF une opération échoue, THEN THE Application SHALL afficher un message d'erreur contextuel via un composant toast
5. THE Application SHALL être responsive et utilisable sur des écrans de largeur minimale de 320px

---

### Requirement 8 : Support Progressive Web App (PWA)

**User Story :** En tant qu'utilisateur, je veux installer l'application sur mon appareil et l'utiliser en mode dégradé hors ligne, afin d'accéder à mes tâches même sans connexion internet.

#### Critères d'acceptation

1. THE Application SHALL fournir un manifeste Web App (manifest.json) valide avec nom, icônes et couleur de thème pour permettre l'installation sur les appareils compatibles
2. THE Application SHALL enregistrer un Service_Worker qui met en cache les ressources statiques (scripts, styles, icônes) lors de la première visite
3. WHILE l'appareil est hors ligne, THE Application SHALL afficher les données précédemment chargées depuis le cache du Service_Worker
4. WHEN l'appareil retrouve une connexion, THE Application SHALL synchroniser les actions effectuées hors ligne avec le serveur
5. IF l'installation PWA est disponible sur le navigateur, THEN THE Application SHALL afficher une invitation à installer l'application

---

### Requirement 9 : Infrastructure Docker Compose

**User Story :** En tant que développeur, je veux démarrer l'environnement complet avec une seule commande, afin de reproduire l'environnement de production localement.

#### Critères d'acceptation

1. THE Application SHALL fournir un fichier docker-compose.yml démarrant les services MySQL et MinIO avec des variables d'environnement configurables
2. WHEN les conteneurs Docker_Compose sont démarrés, THE Application SHALL être accessible et connectée à MySQL et MinIO sans configuration manuelle supplémentaire
3. THE Application SHALL fournir un fichier .env.example documentant toutes les variables d'environnement requises (connexion MySQL, credentials MinIO, secrets OAuth)
4. IF un service Docker_Compose (MySQL ou MinIO) est indisponible au démarrage, THEN THE Application SHALL journaliser une erreur explicite et interrompre le démarrage

---

### Requirement 10 : Persistance des données avec Drizzle ORM

**User Story :** En tant que développeur, je veux que le schéma de base de données soit défini avec Drizzle ORM dans des fichiers d'entités séparés, afin de maintenir une architecture claire et des migrations versionnées.

#### Critères d'acceptation

1. THE Application SHALL définir chaque entité (Utilisateur, Tableau, Colonne, Carte, Pièce_Jointe) dans un fichier Drizzle séparé
2. THE Application SHALL utiliser Drizzle Kit pour générer et appliquer les migrations de schéma MySQL
3. WHEN le schéma d'une entité est modifié, THE Application SHALL générer une migration versionnée sans perte de données existantes
4. THE Application SHALL définir les relations entre entités (clés étrangères, cascades de suppression) directement dans les fichiers de schéma Drizzle
