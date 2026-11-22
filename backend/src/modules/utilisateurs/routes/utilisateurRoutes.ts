import { Router } from 'express';

import {
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../http/middlewares/verificationSessionMiddleware.js';
import { utilisateurController } from '../controllers/utilisateurController.js';

/** Routes montées sous /api/v1/utilisateurs (contrat : document 04). */
export const utilisateurRoutes = Router();

utilisateurRoutes.use(verificationSessionMiddleware);
utilisateurRoutes.get('/', exigerPermission('utilisateurs', 'consultation'), utilisateurController.lister);
utilisateurRoutes.post('/', exigerPermission('utilisateurs', 'administration'), utilisateurController.creer);
utilisateurRoutes.get('/:id', exigerPermission('utilisateurs', 'consultation'), utilisateurController.consulter);
utilisateurRoutes.patch('/:id', exigerPermission('utilisateurs', 'administration'), utilisateurController.modifier);
