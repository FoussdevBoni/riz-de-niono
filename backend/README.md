# Backend Riz de Niono

API REST du MVP : Node.js 22, TypeScript, Express 5 et Mongoose 8 sur MongoDB Atlas (aucune base locale, aucun Docker).
Les documents de référence sont dans `../docs/`. Le contrat d'API est défini dans le document 04, les collections dans le document 03 et l'arborescence dans le document 06.

## Démarrage

```bash
cp .env.example .env     # renseigner MONGODB_URI avec la chaîne de connexion Atlas
npm install
npm run mongo:verifier   # connexion et transaction sur la base de tests
npm run comptes:tests    # compte administrateur et compte limité dans la base de tests
npm run dev              # http://localhost:3000/api/v1
npm run dev:tests        # même API sur la base de tests (comptes COMPTE_TEST_*), pour essayer le frontend
```

`npm test` exécute les tests d'intégration : services Email et Média, authentification, puis référentiels de production sur la base de tests Atlas. Chaque suite se lance aussi seule : `npm run test:services`, `npm run test:auth`, `npm run test:referentiels`, `npm run test:production-stock`, `npm run test:achats`, `npm run test:transformation`, `npm run test:commercialisation`, `npm run test:inventaires-depenses`, `npm run test:consultations`. `npm test` les exécute successivement (`--test-concurrency=1`). Ne pas lancer deux suites Atlas en parallèle : chacune supprime à la fin les comptes de test qu'elle a créés. Les identifiants des comptes de tests sont dans `.env` (variables `COMPTE_TEST_*`).

## Codes internes

Les référentiels à code (campagnes, sites, produits, catégories, matériel, types de travaux et de dépenses, unités de transformation) acceptent une création sans code : l'API l'attribue à partir du nom, et l'index unique garantit l'unicité même lors de créations simultanées (`src/database/codesInternes.ts`). `GET /<ressource>/code-propose?nom=…` renvoie la proposition affichée dans les formulaires. Détails : `../docs/codes-internes-et-saisie-simplifiee.md`.

## Services externes

| Module | Service | Rôle | Variables |
| --- | --- | --- | --- |
| `email/` | `emailService.ts` | Construit et envoie les messages via Resend (réinitialisation du mot de passe) | `RESEND_API_KEY`, `RESEND_FROM` |
| `media/` | `mediaService.ts` | Téléverse et supprime les pièces jointes chez Cloudinary ; renvoie `public_id`, `url_securisee`, `type_ressource` | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_DOSSIER` (facultative) |

Les SDK Resend et Cloudinary ne sont importés que dans ces modules ; ESLint bloque leur import ailleurs. Les modules métier décident quand créer ou supprimer une pièce jointe et conservent sa référence. Les tests n'envoient de vrais e-mails qu'aux adresses de test `…@resend.dev`.

## MongoDB Atlas

Un même cluster Atlas héberge deux bases, créées automatiquement à la première écriture :

- `MONGODB_BASE` (`riz_de_niono`) : la base de l'application ;
- `MONGODB_BASE_TESTS` (`riz_de_niono_tests`) : la base des tests, qui peut être vidée à tout moment.

Côté Atlas : créer un utilisateur de base de données avec le rôle `readWrite` sur ces deux bases, puis autoriser l'adresse IP du poste dans **Network Access**. Atlas fonctionne en replica set : les transactions de validation sont disponibles sans configuration supplémentaire.

Contrôles : `npm run typecheck` et `npm run lint`.

## Organisation

- `src/config/` : paramètres applicatifs lus depuis l'environnement.
- `src/database/` : connexion MongoDB (avec vérification du replica set) et `executerTransaction`.
- `src/http/` : routeur `/api/v1`, format d'erreur commun, pagination et vérification de session.
- `src/modules/<module>/` : `routes/`, `controllers/`, `services/`, `models/` et `schemas/`.

Sens d'appel : route → contrôleur → service → modèle. ESLint bloque l'import d'un modèle, d'un schéma ou de `mongoose` dans un contrôleur ou une route.

## Collections par module

Chaque collection appartient à un seul module. Ses écritures passent par le service de ce module.

| Module | Collections |
| --- | --- |
| authentification | sessions, jetons_reinitialisation |
| utilisateurs (avec le profil) | utilisateurs |
| roles | roles |
| journal-operations | journal_operations |
| parametres-entreprise | parametres_entreprise |
| produits / categories-produits | produits / categories_produits |
| fournisseurs | fournisseurs |
| achats / reglements-fournisseurs | achats / reglements_fournisseurs |
| materiels | materiels |
| types-depenses / depenses | types_depenses / depenses |
| stock | stocks, mouvements_stock |
| inventaires | inventaires |
| ventes | ventes |
| production/* | campagnes_agricoles, sites_production, cultures, types_operations_agricoles, operations_agricoles, equipes_production, productions |
| transformation/* | unites_transformation, operations_transformation |
| commercialisation/* | clients, commandes_clients, encaissements, retours_clients |
| */tableau-de-bord | aucune (lecture via les services des autres modules) |
