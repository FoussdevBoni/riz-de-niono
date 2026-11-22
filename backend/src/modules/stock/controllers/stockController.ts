import { avecNomsProduits } from '../../produits/services/nomsProduitsService.js';
import type { Request, Response } from 'express';

import { lireParametresPagination } from '../../../http/pagination/paginationUtils.js';
import { lireFiltreObjectId, type Donnees } from '../../../http/validation/validationRequete.js';
import { stockService } from '../services/stockService.js';

/** Contrôleur /stock : soldes globaux par produit. */
export const stockController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    reponse.json(await avecNomsProduits(await stockService.listerStocks({ produit_id: lireFiltreObjectId(query, 'produit_id') }, pagination)));
  },
};
