import { Router } from 'express';

import {
  exigerActivite,
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { cultureController } from '../controllers/cultureController.js';

/** Routes montées sous /api/v1/cultures (contrat : document 04). Activité Production. */
export const cultureRoutes = Router();

cultureRoutes.use(verificationSessionMiddleware, exigerActivite('production'));
cultureRoutes.get('/', exigerPermission('cultures', 'consultation'), cultureController.lister);
cultureRoutes.post('/', exigerPermission('cultures', 'saisie'), cultureController.creer);
cultureRoutes.get('/:id', exigerPermission('cultures', 'consultation'), cultureController.consulter);
cultureRoutes.patch('/:id', exigerPermission('cultures', 'saisie'), cultureController.modifier);
