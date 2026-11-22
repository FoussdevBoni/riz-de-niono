import { Router } from 'express';

import {
  exigerActivite,
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { tableauDeBordTransformationController } from '../controllers/tableauDeBordTransformationController.js';

/** Route montée sous /api/v1/tableaux-de-bord/transformation (contrat : document 04). */
export const tableauDeBordTransformationRoutes = Router();

tableauDeBordTransformationRoutes.use(verificationSessionMiddleware, exigerActivite('transformation'));
tableauDeBordTransformationRoutes.get(
  '/',
  exigerPermission('tableau_de_bord_transformation', 'consultation'),
  tableauDeBordTransformationController.consulter,
);
