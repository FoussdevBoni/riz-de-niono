import { Router } from 'express';

import {
  exigerActivite,
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { typeOperationAgricoleController } from '../controllers/typeOperationAgricoleController.js';

/** Routes montées sous /api/v1/types-operations-agricoles (contrat : document 04). Activité Production. */
export const typeOperationAgricoleRoutes = Router();
const MODULE = 'types_operations_agricoles';

typeOperationAgricoleRoutes.use(verificationSessionMiddleware, exigerActivite('production'));
typeOperationAgricoleRoutes.get('/', exigerPermission(MODULE, 'consultation'), typeOperationAgricoleController.lister);
typeOperationAgricoleRoutes.get('/code-propose', exigerPermission(MODULE, 'saisie'), typeOperationAgricoleController.proposerCode);
typeOperationAgricoleRoutes.post('/', exigerPermission(MODULE, 'saisie'), typeOperationAgricoleController.creer);
typeOperationAgricoleRoutes.get('/:id', exigerPermission(MODULE, 'consultation'), typeOperationAgricoleController.consulter);
typeOperationAgricoleRoutes.patch('/:id', exigerPermission(MODULE, 'saisie'), typeOperationAgricoleController.modifier);
