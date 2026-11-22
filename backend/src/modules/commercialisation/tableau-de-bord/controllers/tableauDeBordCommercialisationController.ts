import { avecNomsProduits } from '../../../produits/services/nomsProduitsService.js';
import type { Request, Response } from 'express';

import {
  lireFiltreDate,
  lireFiltreFinPeriode,
  lireFiltreObjectId,
  type Donnees,
} from '../../../../http/validation/validationRequete.js';
import { tableauDeBordCommercialisationService } from '../services/tableauDeBordCommercialisationService.js';

/** Contrôleur /tableaux-de-bord/commercialisation : période (date_debut, date_fin), client_id et produit_id. */
export const tableauDeBordCommercialisationController = {
  async consulter(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    reponse.json(await avecNomsProduits(
      await tableauDeBordCommercialisationService.consulter({
        date_debut: lireFiltreDate(query, 'date_debut'),
        date_fin: lireFiltreFinPeriode(query),
        client_id: lireFiltreObjectId(query, 'client_id'),
        produit_id: lireFiltreObjectId(query, 'produit_id'),
      })),
    );
  },
};
