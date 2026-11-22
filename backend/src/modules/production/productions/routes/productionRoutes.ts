import { Router } from 'express';

import {
  exigerActivite,
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { productionController } from '../controllers/productionController.js';

/** Routes montées sous /api/v1/productions (contrat : document 04). Activité Production. */
export const productionRoutes = Router();
const MODULE = 'productions';

productionRoutes.use(verificationSessionMiddleware, exigerActivite('production'));
productionRoutes.get('/', exigerPermission(MODULE, 'consultation'), productionController.lister);
productionRoutes.post('/', exigerPermission(MODULE, 'saisie'), productionController.creer);
productionRoutes.get('/:id', exigerPermission(MODULE, 'consultation'), productionController.consulter);
productionRoutes.patch('/:id', exigerPermission(MODULE, 'saisie'), productionController.modifier);
productionRoutes.post('/:id/validation', exigerPermission(MODULE, 'validation'), productionController.valider);
productionRoutes.post('/:id/annulation', exigerPermission(MODULE, 'validation'), productionController.annuler);
