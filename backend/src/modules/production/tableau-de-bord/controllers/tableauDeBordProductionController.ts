import { avecNomsProduits } from '../../../produits/services/nomsProduitsService.js';
import type { Request, Response } from 'express';

import { lireSession } from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { lireFiltreObjectId, type Donnees } from '../../../../http/validation/validationRequete.js';
import { tableauDeBordProductionService } from '../services/tableauDeBordProductionService.js';

/** Contrôleur /tableaux-de-bord/production : filtres campagne_id et site_id. */
export const tableauDeBordProductionController = {
  async consulter(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    reponse.json(await avecNomsProduits(
      await tableauDeBordProductionService.consulter(lireSession(reponse), {
        campagne_id: lireFiltreObjectId(query, 'campagne_id'),
        site_id: lireFiltreObjectId(query, 'site_id'),
      })),
    );
  },
};
