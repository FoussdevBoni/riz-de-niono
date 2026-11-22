# Frontend Riz de Niono

Interface web du MVP : React 19, TypeScript, Vite 8 et React Router 7.
Les pages et les interfaces suivent le document 05, l'organisation du code le document 06, et les appels le contrat du document 04 (`../docs/`).

## Démarrage

```bash
npm install
npm run dev   # http://localhost:5173, /api relayé vers http://localhost:3000
```

Pour essayer l'application avec les comptes de tests, lancer l'API sur la base de tests (`npm run dev:tests` dans `backend/`). Les identifiants sont dans `backend/.env` (`COMPTE_TEST_*`).

Contrôles : `npm run typecheck`, `npm run lint` et `npm run build`.

## Organisation

- `src/navigation/` : routes, menus par espace (avec le module de permission de chaque page) et gardes `RouteConnectee`, `RoutePublique`, `RouteAutorisee`.
- `src/layouts/` : espace public et espace de travail connecté.
- `src/pages/` : écrans par espace (authentification, profil, production, transformation, commercialisation, système).
- `src/components/` : composants d'interface communs (champs, alertes, cartes d'indicateurs, états de chargement et d'absence de données).
- `src/hooks/` et `src/utils/` : hooks et fonctions communs, sans accès HTTP.
- `src/api/clientHttp.ts` : transport HTTP, jeton de session et retour vers la connexion quand la session est refusée.
- `src/modules/<module>/` : `services/` pour chaque module, puis `components/`, `hooks/`, `types/` et `utils/` selon les besoins.

Sens d'appel : page ou composant → hook → service → client HTTP. ESLint réserve l'import du client HTTP aux services et l'appel à `fetch` au client HTTP.

## Pages livrées

Connexion, mot de passe oublié, nouveau mot de passe, profil (consultation, modification du nom, changement du mot de passe), tableaux de bord Production, Transformation et Commercialisation, accès refusé et page introuvable. Les autres entrées de menu ouvrent une page « en préparation » protégée par les mêmes droits.
