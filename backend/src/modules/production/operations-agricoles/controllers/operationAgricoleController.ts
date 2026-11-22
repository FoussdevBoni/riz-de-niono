import { avecNomsProduits } from '../../../produits/services/nomsProduitsService.js';
import type { Request, Response } from 'express';

import { erreurs } from '../../../../http/erreurs/erreurApplication.js';
import { lireSession } from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import {
  estObjectId,
  lireCorps,
  lireDate,
  lireDecimal,
  lireEffacable,
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
  operationAgricoleService,
  STATUTS_OPERATION,
  type DonneesOperationAgricole,
  type IntrantSaisi,
} from '../services/operationAgricoleService.js';

function lireIntrants(donnees: Donnees): IntrantSaisi[] | undefined {
  const liste = lireListe(donnees, 'intrants');
  if (liste === undefined) return undefined;
  return liste.map((element, index) => {
    const ligne = (element ?? {}) as Donnees;
    if (!estObjectId(ligne.produit_id)) {
      throw erreurs.donneesInvalides(`Produit invalide pour l’intrant ${index}.`, { champ: `intrants[${index}].produit_id` });
    }
    return {
      produit_id: ligne.produit_id.toLowerCase(),
      quantite: obligatoire(lireQuantite(ligne, 'quantite'), `intrants[${index}].quantite`),
    };
  });
}

function lireDonnees(corps: unknown): DonneesOperationAgricole {
  const donnees = lireCorps(corps);
  return {
    campagne_id: lireObjectId(donnees, 'campagne_id'),
    site_id: lireObjectId(donnees, 'site_id'),
    type_operation_id: lireObjectId(donnees, 'type_operation_id'),
    equipe_id: lireEffacable(donnees, 'equipe_id', lireObjectId),
    date_operation: lireDate(donnees, 'date_operation'),
    journees_travail: lireEffacable(donnees, 'journees_travail', lireDecimal),
    cout_main_oeuvre: lireEffacable(donnees, 'cout_main_oeuvre', lireDecimal),
    intrants: lireIntrants(donnees),
  };
}

/** Contrôleur /operations-agricoles : lit la requête, appelle operationAgricoleService et répond. */
export const operationAgricoleController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    const filtres = {
      campagne_id: lireFiltreObjectId(query, 'campagne_id'),
      site_id: lireFiltreObjectId(query, 'site_id'),
      statut: lireFiltreValeur(query, 'statut', STATUTS_OPERATION),
    };
    reponse.json(await avecNomsProduits(await operationAgricoleService.lister(lireSession(reponse), filtres, pagination)));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await avecNomsProduits(await operationAgricoleService.consulter(lireSession(reponse), lireIdentifiant(requete.params.id))));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const operation = await operationAgricoleService.creer(lireSession(reponse), {
      ...donnees,
      campagne_id: obligatoire(donnees.campagne_id, 'campagne_id'),
      site_id: obligatoire(donnees.site_id, 'site_id'),
      type_operation_id: obligatoire(donnees.type_operation_id, 'type_operation_id'),
      date_operation: obligatoire(donnees.date_operation, 'date_operation'),
    });
    reponse.status(201).json(operation);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await operationAgricoleService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },

  async valider(requete: Request, reponse: Response) {
    reponse.json(await operationAgricoleService.valider(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async annuler(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await operationAgricoleService.annuler(lireSession(reponse), id, lireMotif(requete.body)));
  },
};
