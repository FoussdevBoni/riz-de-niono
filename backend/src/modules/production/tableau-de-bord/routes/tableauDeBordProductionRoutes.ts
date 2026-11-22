import { Router } from 'express';

import {
  exigerActivite,
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { tableauDeBordProductionController } from '../controllers/tableauDeBordProductionController.js';

/** Route montée sous /api/v1/tableaux-de-bord/production (contrat : document 04). */
export const tableauDeBordProductionRoutes = Router();

tableauDeBordProductionRoutes.use(verificationSessionMiddleware, exigerActivite('production'));
tableauDeBordProductionRoutes.get('/', exigerPermission('tableau_de_bord_production', 'consultation'), tableauDeBordProductionController.consulter);
