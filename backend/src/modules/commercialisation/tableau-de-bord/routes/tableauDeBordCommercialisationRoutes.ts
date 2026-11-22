import { Router } from 'express';

import {
  exigerActivite,
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { tableauDeBordCommercialisationController } from '../controllers/tableauDeBordCommercialisationController.js';

/** Route montée sous /api/v1/tableaux-de-bord/commercialisation (contrat : document 04). */
export const tableauDeBordCommercialisationRoutes = Router();

tableauDeBordCommercialisationRoutes.use(verificationSessionMiddleware, exigerActivite('commercialisation'));
tableauDeBordCommercialisationRoutes.get(
  '/',
  exigerPermission('tableau_de_bord_commercialisation', 'consultation'),
  tableauDeBordCommercialisationController.consulter,
);
