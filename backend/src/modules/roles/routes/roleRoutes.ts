import { Router } from 'express';

import {
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../http/middlewares/verificationSessionMiddleware.js';
import { roleController } from '../controllers/roleController.js';

/** Routes montées sous /api/v1/roles (contrat : document 04). */
export const roleRoutes = Router();

roleRoutes.use(verificationSessionMiddleware);
roleRoutes.get('/', exigerPermission('roles', 'consultation'), roleController.lister);
roleRoutes.post('/', exigerPermission('roles', 'administration'), roleController.creer);
roleRoutes.get('/:id', exigerPermission('roles', 'consultation'), roleController.consulter);
roleRoutes.patch('/:id', exigerPermission('roles', 'administration'), roleController.modifier);
