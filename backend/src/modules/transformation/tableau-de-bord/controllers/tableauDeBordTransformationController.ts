import { avecNomsProduits } from '../../../produits/services/nomsProduitsService.js';
import type { Request, Response } from 'express';

import {
  lireFiltreDate,
  lireFiltreFinPeriode,
  lireFiltreObjectId,
  type Donnees,
} from '../../../../http/validation/validationRequete.js';
import { tableauDeBordTransformationService } from '../services/tableauDeBordTransformationService.js';

/** Contrôleur /tableaux-de-bord/transformation : filtres unite_transformation_id, date_debut et date_fin (période). */
export const tableauDeBordTransformationController = {
  async consulter(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    reponse.json(await avecNomsProduits(
      await tableauDeBordTransformationService.consulter({
        unite_transformation_id: lireFiltreObjectId(query, 'unite_transformation_id'),
        date_debut: lireFiltreDate(query, 'date_debut'),
        date_fin: lireFiltreFinPeriode(query),
      })),
    );
  },
};
