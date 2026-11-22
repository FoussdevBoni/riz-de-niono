import { Router } from 'express';

import {
  exigerActivite,
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { uniteTransformationController } from '../controllers/uniteTransformationController.js';

/** Routes montées sous /api/v1/unites-transformation (contrat : document 04). Activité Transformation. */
export const uniteTransformationRoutes = Router();
const MODULE = 'unites_transformation';

uniteTransformationRoutes.use(verificationSessionMiddleware, exigerActivite('transformation'));
uniteTransformationRoutes.get('/', exigerPermission(MODULE, 'consultation'), uniteTransformationController.lister);
uniteTransformationRoutes.get('/code-propose', exigerPermission(MODULE, 'saisie'), uniteTransformationController.proposerCode);
uniteTransformationRoutes.post('/', exigerPermission(MODULE, 'saisie'), uniteTransformationController.creer);
uniteTransformationRoutes.get('/:id', exigerPermission(MODULE, 'consultation'), uniteTransformationController.consulter);
uniteTransformationRoutes.patch('/:id', exigerPermission(MODULE, 'saisie'), uniteTransformationController.modifier);
