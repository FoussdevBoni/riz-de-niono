import { avecNomsProduits } from '../../produits/services/nomsProduitsService.js';
import type { Request, Response } from 'express';

import { lireSession } from '../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../http/pagination/paginationUtils.js';
import {
  lireFiltreDate,
  lireFiltreObjectId,
  lireFiltreValeur,
  lireIdentifiant,
  lireMotif,
  type Donnees,
} from '../../../http/validation/validationRequete.js';
import { SENS_MOUVEMENT, stockService, TYPES_ORIGINE } from '../services/stockService.js';

/** Contrôleur /mouvements-stock : historique, fiche d'un mouvement et correction des écritures manuelles. */
export const mouvementStockController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    const filtres = {
      produit_id: lireFiltreObjectId(query, 'produit_id'),
      sens: lireFiltreValeur(query, 'sens', SENS_MOUVEMENT),
      origine_type: lireFiltreValeur(query, 'origine_type', TYPES_ORIGINE),
      origine_id: lireFiltreObjectId(query, 'origine_id'),
      date_debut: lireFiltreDate(query, 'date_debut'),
      date_fin: lireFiltreDate(query, 'date_fin'),
    };
    reponse.json(await avecNomsProduits(await stockService.listerMouvements(filtres, pagination)));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await avecNomsProduits(await stockService.consulterMouvement(lireIdentifiant(requete.params.id))));
  },

  async corriger(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await stockService.corrigerMouvement(lireSession(reponse), id, lireMotif(requete.body)));
  },
};
