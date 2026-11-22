import { Router } from 'express';

import {
  exigerActivite,
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { operationTransformationController } from '../controllers/operationTransformationController.js';

/** Routes montées sous /api/v1/operations-transformation (contrat : document 04). Activité Transformation. */
export const operationTransformationRoutes = Router();
const MODULE = 'operations_transformation';

operationTransformationRoutes.use(verificationSessionMiddleware, exigerActivite('transformation'));
operationTransformationRoutes.get('/', exigerPermission(MODULE, 'consultation'), operationTransformationController.lister);
operationTransformationRoutes.post('/', exigerPermission(MODULE, 'saisie'), operationTransformationController.creer);
operationTransformationRoutes.get('/:id', exigerPermission(MODULE, 'consultation'), operationTransformationController.consulter);
operationTransformationRoutes.patch('/:id', exigerPermission(MODULE, 'saisie'), operationTransformationController.modifier);
operationTransformationRoutes.post('/:id/validation', exigerPermission(MODULE, 'validation'), operationTransformationController.valider);
operationTransformationRoutes.post('/:id/annulation', exigerPermission(MODULE, 'validation'), operationTransformationController.annuler);
