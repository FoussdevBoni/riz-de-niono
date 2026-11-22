# Codes internes proposés et saisie simplifiée

Complément aux documents 04 (API) et 05 (pages du frontend).

## Codes internes des référentiels

Huit fiches portent un code interne unique : campagnes agricoles, sites de production, produits, catégories de produits, matériel, types de travaux agricoles, types de dépenses et unités de transformation. Les rôles gardent un code saisi : il sert aux habilitations.

### Règle de génération

Le code est tiré du nom saisi :

1. accents retirés, passage en majuscules ;
2. mots vides retirés (de, du, des, la, le, les, d’, l’, et, à, au, aux, en, pour, sur, un, une) ;
3. mots restants reliés par des tirets, dans la limite de 26 caractères ;
4. un suffixe numérique est ajouté si le code est déjà pris : `-2`, puis `-3`, etc.

Exemples : « Casier de Kokry » donne `CASIER-KOKRY`, « Engrais NPK 15-15-15 » donne `ENGRAIS-NPK-15-15-15`, et un second « Casier de Kokry » donne `CASIER-KOKRY-2`. Sans nom exploitable, le préfixe du module sert de base (`SITE`, `PRODUIT`, `CAMPAGNE`…).

Les codes des éléments supprimés ou archivés restent réservés : un code n’est jamais réattribué.

### Unicité

L’unicité repose sur l’index unique du champ `code` en base, pas sur un comptage côté frontend. En création sans code, le service essaie le premier code libre. Si une création simultanée l’obtient avant lui (erreur de doublon), il rejoue l’insertion avec le code libre suivant. Le mécanisme est dans `backend/src/database/codesInternes.ts` ; il est utilisé par le service de chaque module.

Un code saisi par l’utilisateur est conservé tel quel. S’il est déjà pris, l’API répond `409 code_deja_utilise`, comme avant.

### API

- `GET /api/v1/<ressource>/code-propose?nom=…` renvoie `{ "code": "CASIER-KOKRY" }`. Il exige la permission de saisie du module. La proposition ne réserve rien.
- Dans `POST /api/v1/<ressource>`, le champ `code` devient facultatif. S’il est absent, l’API attribue le code à partir de `nom`.

Ressources concernées : `campagnes-agricoles`, `sites-production`, `produits`, `categories-produits`, `materiels`, `types-operations-agricoles`, `types-depenses`, `unites-transformation`.

### Formulaires

En création, le champ « Code » affiche la proposition dès que le nom est saisi, avec la mention « Proposé à partir du nom ». Si l’utilisateur garde la proposition, le frontend n’envoie pas de code et l’API attribue définitivement le code. S’il saisit son propre code, celui-ci est envoyé tel quel ; « Reprendre la proposition » revient au code proposé. En modification, le code existant est affiché et reste modifiable selon les règles du module.

## Valeurs déduites dans les autres formulaires

L’application ne remplit un champ que si la valeur est certaine. Elle reste toujours modifiable.

| Formulaire | Valeur proposée |
| --- | --- |
| Travaux agricoles, cultures, dépenses, récoltes | La campagne ouverte, si une seule est ouverte ou si une seule couvre la date du jour ; puis le site, s’il est le seul possible pour cette campagne. |
| Récolte | La date du jour ; le produit, s’il est le seul récoltable. Le rendement (kg/ha) est calculé pendant la saisie. |
| Travail agricole | La date du jour. |
| Opération de transformation | L’unité, s’il n’y a qu’une unité active. |
| Règlement fournisseur | Le solde dû de l’achat choisi comme montant, et un bouton « Régler le solde ». |
| Encaissement | Un bouton « Encaisser le solde ». Le montant n’est pas pré-rempli, car les paiements partiels sont fréquents. |

## Brouillons

Un brouillon n’est conservé qu’après une première saisie : ouvrir puis fermer un formulaire sans rien taper ne crée plus de « brouillon repris ». Le reste ne change pas :

- clé par compte, page et formulaire ;
- lignes incomplètes conservées ;
- saisie gardée en cas d’erreur ;
- brouillon effacé après réussite ;
- confirmation avant de supprimer un brouillon ;
- mots de passe jamais conservés.
