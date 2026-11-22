import type { Request, Response } from 'express';

import { lireSession } from '../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../http/pagination/paginationUtils.js';
import {
  lireFiltreDate,
  lireFiltreObjectId,
  lireFiltreValeur,
  lireIdentifiant,
  type Donnees,
} from '../../../http/validation/validationRequete.js';
import { ACTIONS_JOURNAL, journalOperationService } from '../services/journalOperationService.js';

/** Contrôleur /journal-operations : lit la requête, appelle journalOperationService et répond. */
export const journalOperationController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    const filtres = {
      utilisateur_id: lireFiltreObjectId(query, 'utilisateur_id'),
      action: lireFiltreValeur(query, 'action', ACTIONS_JOURNAL),
      date_debut: lireFiltreDate(query, 'date_debut'),
      date_fin: lireFiltreDate(query, 'date_fin'),
    };
    reponse.json(await journalOperationService.lister(lireSession(reponse), filtres, pagination));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await journalOperationService.consulter(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },
};
