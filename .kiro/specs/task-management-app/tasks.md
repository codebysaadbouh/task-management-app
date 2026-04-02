# Plan d'implémentation : Task Management App

## Vue d'ensemble

Implémentation incrémentale d'une PWA Kanban fullstack en Next.js 15 (App Router, Server Actions), avec Drizzle ORM + MySQL, MinIO pour les pièces jointes, NextAuth.js v5 pour l'authentification, ShadCN/UI + @dnd-kit pour l'interface, et Vitest + fast-check + Playwright pour les tests.

## Tâches

- [x] 1. Initialisation du projet et infrastructure
  - [x] 1.1 Initialiser le projet Next.js 15 avec TypeScript et installer toutes les dépendances
    - Créer le projet avec `npx create-next-app@latest` (App Router, TypeScript, Tailwind)
    - Installer les dépendances de production et de développement listées dans le design
    - Initialiser ShadCN/UI avec `npx shadcn@latest init`
    - _Requirements: 9.1, 10.1_

  - [x] 1.2 Créer le fichier `docker-compose.yml` avec MySQL et MinIO
    - Définir les services `mysql` et `minio` avec variables d'environnement configurables
    - Exposer les ports 3306 (MySQL) et 9000/9001 (MinIO)
    - Ajouter un service `createbuckets` pour initialiser le bucket MinIO au démarrage
    - _Requirements: 9.1, 9.2_

  - [x] 1.3 Créer le fichier `.env.example` avec toutes les variables requises
    - Variables MySQL : `DATABASE_URL`, `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`
    - Variables MinIO : `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`
    - Variables Auth : `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
    - _Requirements: 9.3_

  - [x] 1.4 Écrire un test unitaire vérifiant que `.env.example` contient toutes les variables requises
    - Lire le fichier et vérifier la présence de chaque clé attendue
    - _Requirements: 9.3_

- [x] 2. Schéma Drizzle et connexion base de données
  - [x] 2.1 Créer la connexion Drizzle dans `src/server/db/index.ts`
    - Configurer le client `mysql2` et l'instance `drizzle`
    - Gérer l'erreur de connexion avec un log explicite (requirement 9.4)
    - _Requirements: 9.4, 10.1_

  - [x] 2.2 Créer les fichiers de schéma Drizzle séparés dans `src/server/db/schema/`
    - `users.ts` : table `users` avec id UUID, email unique, passwordHash, name, image, createdAt
    - `boards.ts` : table `boards` avec id, userId FK, name, createdAt, updatedAt
    - `columns.ts` : table `columns` avec id, boardId FK, name, order, createdAt
    - `cards.ts` : table `cards` avec id, columnId FK, title, description, order, createdAt, updatedAt
    - `attachments.ts` : table `attachments` avec id, cardId FK, name, size, mimeType, storageKey, createdAt
    - Créer `relations.ts` avec toutes les relations Drizzle (cascades de suppression)
    - _Requirements: 10.1, 10.4_

  - [x] 2.3 Configurer `drizzle.config.ts` et générer la migration initiale
    - Configurer drizzle-kit avec le dialecte MySQL et le chemin vers les schémas
    - Générer la migration avec `npx drizzle-kit generate`
    - _Requirements: 10.2, 10.3_

  - [x] 2.4 Écrire un test unitaire vérifiant que les fichiers de schéma existent séparément
    - Vérifier l'existence de chacun des 5 fichiers d'entités
    - _Requirements: 10.1_

- [x] 3. Authentification email/password avec NextAuth.js v5
  - [x] 3.1 Créer la configuration NextAuth dans `src/lib/auth.ts`
    - Configurer le `Credentials` provider avec `authorize()` qui vérifie email + bcrypt
    - Configurer le `@auth/drizzle-adapter` avec la connexion Drizzle
    - Définir les callbacks `session` et `jwt`
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 3.2 Créer la route `src/app/api/auth/[...nextauth]/route.ts`
    - Exporter les handlers GET et POST depuis la config NextAuth
    - _Requirements: 1.1, 1.2_

  - [x] 3.3 Créer les schémas Zod dans `src/lib/validations.ts`
    - `registerSchema` : email valide, password ≥ 8 caractères
    - `loginSchema` : email + password non vides
    - `boardSchema`, `columnSchema`, `cardSchema`, `attachmentSchema`
    - _Requirements: 1.1, 1.3_

  - [x] 3.4 Créer la Server Action d'inscription dans `src/server/actions/auth.actions.ts`
    - Valider avec `registerSchema`, vérifier l'unicité de l'email, hasher avec bcryptjs, insérer en base
    - Retourner `ActionResult<User>` (type discriminé défini dans le design)
    - _Requirements: 1.1, 1.4, 1.5_

  - [x] 3.5 Créer les pages d'authentification `src/app/(auth)/login/page.tsx` et `register/page.tsx`
    - Formulaires avec composants ShadCN (Input, Button, Form)
    - Affichage des erreurs inline et toast en cas d'échec
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 7.4_

  - [x] 3.6 Écrire le test de propriété P1 : Round-trip inscription → connexion
    - **Propriété 1 : Pour tout email valide et mot de passe valide, inscription puis connexion doit réussir**
    - **Valide : Requirements 1.1, 1.2**
    - Générateurs : `fc.emailAddress()`, `fc.string({ minLength: 8 })`

  - [x] 3.7 Écrire le test de propriété P2 : Identifiants invalides retournent une erreur générique
    - **Propriété 2 : Pour tout couple (email inexistant, password), la connexion doit échouer sans préciser le champ**
    - **Valide : Requirements 1.3**
    - Générateurs : `fc.emailAddress()`, `fc.string()`

  - [x] 3.8 Écrire le test de propriété P3 : Unicité de l'email à l'inscription
    - **Propriété 3 : Pour tout email déjà inscrit, une seconde inscription doit être rejetée**
    - **Valide : Requirements 1.4**
    - Générateur : `fc.emailAddress()`

  - [x] 3.9 Écrire le test de propriété P4 : Mots de passe stockés hachés
    - **Propriété 4 : Pour tout mot de passe, la valeur en base ne doit jamais être égale au plaintext**
    - **Valide : Requirements 1.5**
    - Générateur : `fc.string({ minLength: 1 })`

- [x] 4. Authentification Google OAuth
  - [x] 4.1 Ajouter le `Google` provider dans la config NextAuth
    - Configurer `clientId` et `clientSecret` depuis les variables d'environnement
    - Activer la liaison de compte OAuth avec un compte email existant
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 4.2 Ajouter le bouton "Connexion avec Google" sur la page de login
    - Utiliser `signIn('google')` de NextAuth
    - Gérer l'affichage d'erreur en cas de refus OAuth (requirement 2.3)
    - _Requirements: 2.1, 2.3_

  - [x] 4.3 Écrire le test de propriété P6 : Callback OAuth crée ou associe un utilisateur
    - **Propriété 6 : Pour tout profil OAuth Google valide, exactement un utilisateur doit exister en base**
    - **Valide : Requirements 2.2, 2.4**
    - Générateur : `fc.record({ email: fc.emailAddress(), name: fc.string() })`

- [x] 5. Checkpoint — Authentification complète
  - S'assurer que tous les tests d'authentification passent, demander à l'utilisateur si des questions se posent.

- [x] 6. Gestion des tableaux (boards)
  - [x] 6.1 Créer `src/server/services/board.service.ts`
    - `createBoard(userId, name)` : insérer en base, retourner le tableau créé
    - `getUserBoards(userId)` : sélectionner uniquement les tableaux de l'utilisateur
    - `renameBoard(userId, boardId, name)` : vérifier ownership (403 si non propriétaire), mettre à jour
    - `deleteBoard(userId, boardId)` : vérifier ownership, supprimer (cascade automatique)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 6.2 Créer `src/server/actions/board.actions.ts`
    - Wrapper Server Actions autour du service, récupérer la session, retourner `ActionResult<T>`
    - `createBoard`, `getUserBoards`, `renameBoard`, `deleteBoard`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 6.3 Créer la page dashboard `src/app/(app)/dashboard/page.tsx`
    - Server Component : charger les tableaux de l'utilisateur connecté
    - Afficher la liste des tableaux avec options renommer/supprimer
    - Formulaire de création de tableau (ShadCN Dialog + Input)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 7.1_

  - [x] 6.4 Écrire le test de propriété P7 : Round-trip création d'entité (boards)
    - **Propriété 7 : Pour tout nom valide, créer un tableau puis le relire doit retourner les mêmes données**
    - **Valide : Requirements 3.1**
    - Générateur : `fc.string({ minLength: 1, maxLength: 255 })`

  - [x] 6.5 Écrire le test de propriété P8 : Mise à jour persistée (boards)
    - **Propriété 8 : Pour tout nouveau nom, renommer un tableau puis le relire doit retourner le nouveau nom**
    - **Valide : Requirements 3.2**
    - Générateur : `fc.string({ minLength: 1, maxLength: 255 })`

  - [x] 6.6 Écrire le test de propriété P10 : Isolation des tableaux par utilisateur
    - **Propriété 10 : Pour tout ensemble d'utilisateurs, getUserBoards ne retourne que les tableaux du propriétaire**
    - **Valide : Requirements 3.4**
    - Générateur : `fc.array(fc.record({ userId: fc.uuid(), boardName: fc.string() }))`

  - [x] 6.7 Écrire le test de propriété P11 : Contrôle d'accès 403
    - **Propriété 11 : Pour tout tableau appartenant à l'utilisateur A, l'accès par l'utilisateur B doit retourner 403**
    - **Valide : Requirements 3.5**
    - Générateurs : deux UUIDs distincts

- [x] 7. Gestion des colonnes
  - [x] 7.1 Créer `src/server/services/board.service.ts` — fonctions colonnes (ou `column.service.ts`)
    - `addColumn(userId, boardId, name)` : vérifier ownership du board, insérer avec order = max+1
    - `reorderColumns(userId, boardId, orderedIds)` : vérifier ownership, mettre à jour les ordres en transaction
    - `renameColumn(userId, columnId, name)` : vérifier ownership via join board, mettre à jour
    - `deleteColumn(userId, columnId)` : vérifier ownership, supprimer (cascade cartes)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 7.2 Créer `src/server/actions/column.actions.ts`
    - `addColumn`, `reorderColumns`, `renameColumn`, `deleteColumn`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 7.3 Écrire le test de propriété P12 : Réordonnancement des colonnes persisté
    - **Propriété 12 : Pour toute permutation valide d'IDs de colonnes, l'ordre en base doit correspondre exactement**
    - **Valide : Requirements 4.2, 4.5**
    - Générateur : `fc.shuffledSubarray(ids)`

- [x] 8. Gestion des cartes
  - [x] 8.1 Créer `src/server/services/card.service.ts`
    - `createCard(userId, columnId, title, description?)` : vérifier ownership via join, insérer avec order = max+1
    - `moveCard(userId, cardId, targetColumnId, newOrder)` : vérifier ownership, mettre à jour columnId et order en transaction, réindexer les ordres
    - `updateCard(userId, cardId, data)` : vérifier ownership, mettre à jour title/description
    - `deleteCard(userId, cardId)` : vérifier ownership, supprimer (cascade pièces jointes)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 8.2 Créer `src/server/actions/card.actions.ts`
    - `createCard`, `moveCard`, `updateCard`, `deleteCard`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 8.3 Écrire le test de propriété P7 : Round-trip création d'entité (cards)
    - **Propriété 7 : Pour tout titre valide, créer une carte puis la relire doit retourner les mêmes données**
    - **Valide : Requirements 5.1**
    - Générateur : `fc.string({ minLength: 1, maxLength: 500 })`

  - [x] 8.4 Écrire le test de propriété P13 : Déplacement de carte persisté
    - **Propriété 13 : Pour toute carte et colonne cible valide, après déplacement les ordres doivent rester cohérents (pas de doublons)**
    - **Valide : Requirements 5.2, 5.5**
    - Générateurs : IDs aléatoires, ordres entiers

  - [x] 8.5 Écrire le test de propriété P9 : Cascade de suppression
    - **Propriété 9 : Pour tout tableau/colonne/carte supprimé, aucun enfant ne doit subsister en base**
    - **Valide : Requirements 3.3, 4.4, 5.4**
    - Générateur : arbres (board → columns → cards) générés aléatoirement

- [x] 9. Checkpoint — CRUD complet
  - S'assurer que tous les tests de services et actions passent, demander à l'utilisateur si des questions se posent.

- [x] 10. Interface Kanban avec @dnd-kit
  - [x] 10.1 Créer le composant `src/components/board/KanbanBoard.tsx`
    - Configurer `DndContext` avec les sensors souris/tactile
    - Gérer les événements `onDragEnd` pour cartes et colonnes
    - Mise à jour optimiste de l'état local avant appel Server Action
    - Rollback en cas d'échec (requirement 7.2)
    - _Requirements: 4.2, 5.2, 7.2_

  - [x] 10.2 Créer `src/components/board/BoardColumn.tsx`
    - Colonne droppable avec `useDroppable` de @dnd-kit
    - Afficher le nom, boutons renommer/supprimer, liste de `BoardCard`
    - _Requirements: 4.3, 4.4, 7.1_

  - [x] 10.3 Créer `src/components/board/BoardCard.tsx`
    - Carte draggable avec `useSortable` de @dnd-kit/sortable
    - Afficher titre, badges, indicateur de chargement pendant les opérations
    - _Requirements: 5.1, 7.2, 7.3_

  - [x] 10.4 Créer la page `src/app/(app)/boards/[boardId]/page.tsx`
    - Server Component : charger le board avec ses colonnes et cartes (vérifier ownership → 403)
    - Passer les données au `KanbanBoard` client
    - _Requirements: 3.5, 4.5, 5.5_

- [x] 11. Détail de carte et pièces jointes
  - [x] 11.1 Créer `src/server/services/attachment.service.ts`
    - `uploadAttachment(userId, cardId, file)` : vérifier taille ≤ 20 Mo, uploader dans MinIO, insérer métadonnées en transaction (rollback si MinIO KO)
    - `getDownloadUrl(userId, attachmentId)` : générer URL signée MinIO avec expiration
    - `deleteAttachment(userId, attachmentId)` : supprimer de MinIO puis de la base (atomique)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_

  - [x] 11.2 Créer `src/server/actions/attachment.actions.ts`
    - `uploadAttachment`, `getDownloadUrl`, `deleteAttachment`
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 11.3 Créer la route `src/app/api/attachments/[id]/download/route.ts`
    - Vérifier la session, appeler `getDownloadUrl`, rediriger vers l'URL signée
    - _Requirements: 6.2_

  - [x] 11.4 Créer `src/lib/minio.ts`
    - Initialiser le client MinIO avec les variables d'environnement
    - Exporter les fonctions `putObject`, `removeObject`, `presignedGetObject`
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 11.5 Créer `src/components/card/CardDetail.tsx` et `AttachmentList.tsx`
    - Modal ShadCN avec édition titre/description, liste des pièces jointes
    - Upload via `<input type="file">` avec validation taille côté client
    - Afficher nom, taille, date pour chaque pièce jointe (requirement 6.5)
    - _Requirements: 6.1, 6.4, 6.5, 7.1, 7.3, 7.4_

  - [x] 11.6 Écrire le test de propriété P14 : Round-trip upload de pièce jointe
    - **Propriété 14 : Pour tout fichier valide (≤ 20 Mo), les métadonnées retournées doivent correspondre au fichier original**
    - **Valide : Requirements 6.1, 6.5**
    - Générateur : `fc.uint8Array()` avec taille bornée à 20 Mo

  - [x] 11.7 Écrire le test de propriété P15 : URL signée non-vide avec expiration
    - **Propriété 15 : Pour toute pièce jointe existante, getDownloadUrl doit retourner une URL contenant un paramètre d'expiration**
    - **Valide : Requirements 6.2**
    - Pièces jointes mockées

  - [x] 11.8 Écrire le test de propriété P16 : Suppression atomique pièce jointe
    - **Propriété 16 : Pour toute pièce jointe supprimée, ni les métadonnées ni le fichier MinIO ne doivent être accessibles**
    - **Valide : Requirements 6.3**

  - [x] 11.9 Écrire le test de propriété P17 : Rejet des fichiers trop volumineux
    - **Propriété 17 : Pour tout fichier > 20 Mo, l'upload doit être rejeté sans insérer de métadonnées**
    - **Valide : Requirements 6.4**
    - Générateur : `fc.integer({ min: 20971521 })` pour la taille

  - [x] 11.10 Écrire le test de propriété P18 : Atomicité en cas d'indisponibilité MinIO
    - **Propriété 18 : Lorsque MinIO retourne une erreur, aucune métadonnée ne doit être persistée en base**
    - **Valide : Requirements 6.6**
    - MinIO mock qui lève une erreur

- [x] 12. Checkpoint — Pièces jointes complètes
  - S'assurer que tous les tests de pièces jointes passent, demander à l'utilisateur si des questions se posent.

- [x] 13. PWA : manifest et Service Worker
  - [x] 13.1 Créer `public/manifest.json` avec les champs requis
    - Inclure `name`, `short_name`, `icons` (192px et 512px), `theme_color`, `background_color`, `display: standalone`
    - Ajouter le lien `<link rel="manifest">` dans `src/app/layout.tsx`
    - _Requirements: 8.1_

  - [x] 13.2 Créer `public/sw.js` — Service Worker avec stratégie cache-first pour les ressources statiques
    - Événements `install` (précache), `activate` (nettoyage ancien cache), `fetch` (cache-first)
    - Enregistrer le SW dans un Client Component `src/components/ServiceWorkerRegistration.tsx`
    - _Requirements: 8.2, 8.3_

  - [x] 13.3 Implémenter la synchronisation offline dans le Service Worker
    - Stocker les actions pending dans IndexedDB (création/modification de carte)
    - Rejouer les actions au rétablissement de la connexion (événement `sync` ou `online`)
    - Stratégie "server wins" en cas de conflit
    - _Requirements: 8.4_

  - [x] 13.4 Ajouter le prompt d'installation PWA dans l'interface
    - Écouter l'événement `beforeinstallprompt`, afficher un bouton ShadCN pour déclencher l'installation
    - _Requirements: 8.5_

  - [x] 13.5 Écrire un test unitaire vérifiant que `manifest.json` contient les champs requis
    - Vérifier la présence de `name`, `icons`, `theme_color`
    - _Requirements: 8.1_

  - [x] 13.6 Écrire le test de propriété P19 : Synchronisation offline → online
    - **Propriété 19 : Pour toute action effectuée hors ligne, après reconnexion l'état serveur doit refléter ces actions**
    - **Valide : Requirements 8.4**
    - Actions mockées en IndexedDB

- [x] 14. Middleware et protection des routes
  - [x] 14.1 Créer `src/middleware.ts` avec NextAuth
    - Protéger toutes les routes `/(app)/*` : rediriger vers `/login` si non authentifié
    - Rediriger vers `/dashboard` si déjà authentifié sur `/login` et `/register`
    - _Requirements: 1.6, 3.5_

  - [x] 14.2 Écrire le test de propriété P5 : Déconnexion invalide la session
    - **Propriété 5 : Pour tout utilisateur authentifié, après déconnexion toute route protégée doit être inaccessible**
    - **Valide : Requirements 1.6**
    - Session mock

- [x] 15. Intégration finale et câblage
  - [x] 15.1 Câbler le layout principal `src/app/layout.tsx`
    - Ajouter `SessionProvider`, `Toaster` ShadCN, lien manifest, enregistrement SW
    - Créer le layout `src/app/(app)/layout.tsx` avec la navbar et la vérification de session
    - _Requirements: 7.1, 7.4, 8.1_

  - [x] 15.2 Ajouter les indicateurs de chargement et toasts d'erreur globaux
    - Utiliser `useTransition` / `isPending` de React pour les états de chargement
    - Afficher les toasts ShadCN pour toutes les erreurs des Server Actions
    - _Requirements: 7.3, 7.4_

  - [x] 15.3 Vérifier la responsivité sur 320px de largeur minimale
    - Ajuster les classes Tailwind pour les breakpoints mobiles sur toutes les pages
    - _Requirements: 7.5_

- [x] 16. Checkpoint final — Tous les tests passent
  - S'assurer que tous les tests unitaires, de propriétés et d'intégration passent, demander à l'utilisateur si des questions se posent.

## Notes

- Les tâches marquées `*` sont optionnelles et peuvent être ignorées pour un MVP rapide
- Chaque tâche référence les requirements spécifiques pour la traçabilité
- Les tests de propriétés utilisent fast-check avec minimum 100 itérations (`{ numRuns: 100 }`)
- Le tag obligatoire pour chaque test de propriété : `// Feature: task-management-app, Property {N}: {texte}`
- Les Server Actions retournent toujours `ActionResult<T>` (type discriminé success/error)
- La mise à jour optimiste du Kanban doit toujours prévoir un rollback en cas d'échec
