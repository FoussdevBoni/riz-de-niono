import { avecNomsProduits } from '../../../produits/services/nomsProduitsService.js';
import type { Request, Response } from 'express';

import { erreurs } from '../../../../http/erreurs/erreurApplication.js';
import { lireSession } from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import {
  estObjectId,
  lireChaine,
  lireCorps,
  lireDate,
  lireEffacable,
  lireFiltreDate,
  lireFiltreFinPeriode,
  lireFiltreObjectId,
  lireFiltreValeur,
  lireIdentifiant,
  lireListe,
  lireMotif,
  lireObjectId,
  lireQuantite,
  obligatoire,
  type Donnees,
} from '../../../../http/validation/validationRequete.js';
import {
  operationTransformationService,
  STATUTS_OPERATION,
  type DonneesOperationTransformation,
  type ResultatSaisi,
} from '../services/operationTransformationService.js';

function lireResultats(donnees: Donnees): ResultatSaisi[] | undefined {
  const liste = lireListe(donnees, 'resultats');
  if (liste === undefined) return undefined;
  return liste.map((element, index) => {
    const ligne = (element ?? {}) as Donnees;
    if (!estObjectId(ligne.produit_id)) {
      throw erreurs.donneesInvalides(`Produit invalide pour le résultat ${index}.`, { champ: `resultats[${index}].produit_id` });
    }
    return {
      produit_id: ligne.produit_id.toLowerCase(),
      quantite: obligatoire(lireQuantite(ligne, 'quantite'), `resultats[${index}].quantite`),
    };
  });
}

function lireDonnees(corps: unknown): DonneesOperationTransformation {
  const donnees = lireCorps(corps);
  return {
    unite_transformation_id: lireObjectId(donnees, 'unite_transformation_id'),
    date_operation: lireDate(donnees, 'date_operation'),
    paddy_produit_id: lireObjectId(donnees, 'paddy_produit_id'),
    quantite_paddy: lireQuantite(donnees, 'quantite_paddy'),
    resultats: lireResultats(donnees),
    note_ecart: lireEffacable(donnees, 'note_ecart', (d, champ) => lireChaine(d, champ, { max: 1000 })),
  };
}

/** Contrôleur /operations-transformation : lit la requête, appelle operationTransformationService et répond. */
export const operationTransformationController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    const filtres = {
      unite_transformation_id: lireFiltreObjectId(query, 'unite_transformation_id'),
      statut: lireFiltreValeur(query, 'statut', STATUTS_OPERATION),
      date_debut: lireFiltreDate(query, 'date_debut'),
      // Une date de fin sans heure couvre toute la journée (même règle que les tableaux de bord).
      date_fin: lireFiltreFinPeriode(query),
    };
    reponse.json(await avecNomsProduits(await operationTransformationService.lister(filtres, pagination)));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await avecNomsProduits(await operationTransformationService.consulter(lireIdentifiant(requete.params.id))));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const operation = await operationTransformationService.creer(lireSession(reponse), {
      unite_transformation_id: obligatoire(donnees.unite_transformation_id, 'unite_transformation_id'),
      date_operation: obligatoire(donnees.date_operation, 'date_operation'),
      paddy_produit_id: obligatoire(donnees.paddy_produit_id, 'paddy_produit_id'),
      quantite_paddy: obligatoire(donnees.quantite_paddy, 'quantite_paddy'),
      resultats: obligatoire(donnees.resultats, 'resultats'),
      note_ecart: donnees.note_ecart,
    });
    reponse.status(201).json(operation);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await operationTransformationService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },

  async valider(requete: Request, reponse: Response) {
    reponse.json(await operationTransformationService.valider(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async annuler(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await operationTransformationService.annuler(lireSession(reponse), id, lireMotif(requete.body)));
  },
};
