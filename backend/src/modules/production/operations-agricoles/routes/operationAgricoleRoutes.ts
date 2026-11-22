import { Router } from 'express';

import {
  exigerActivite,
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { operationAgricoleController } from '../controllers/operationAgricoleController.js';

/** Routes montées sous /api/v1/operations-agricoles (contrat : document 04). Activité Production. */
export const operationAgricoleRoutes = Router();
const MODULE = 'operations_agricoles';

operationAgricoleRoutes.use(verificationSessionMiddleware, exigerActivite('production'));
operationAgricoleRoutes.get('/', exigerPermission(MODULE, 'consultation'), operationAgricoleController.lister);
operationAgricoleRoutes.post('/', exigerPermission(MODULE, 'saisie'), operationAgricoleController.creer);
operationAgricoleRoutes.get('/:id', exigerPermission(MODULE, 'consultation'), operationAgricoleController.consulter);
operationAgricoleRoutes.patch('/:id', exigerPermission(MODULE, 'saisie'), operationAgricoleController.modifier);
operationAgricoleRoutes.post('/:id/validation', exigerPermission(MODULE, 'validation'), operationAgricoleController.valider);
operationAgricoleRoutes.post('/:id/annulation', exigerPermission(MODULE, 'validation'), operationAgricoleController.annuler);
