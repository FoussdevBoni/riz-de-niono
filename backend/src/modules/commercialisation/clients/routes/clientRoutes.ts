import { Router } from 'express';

import {
  exigerPermission,
  exigerUneActivite,
  verificationSessionMiddleware,
} from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { clientController } from '../controllers/clientController.js';

/**
 * Routes montées sous /api/v1/clients (contrat : document 04).
 * Les clients servent aux ventes de production et à la commercialisation.
 */
export const clientRoutes = Router();

clientRoutes.use(verificationSessionMiddleware, exigerUneActivite(['production', 'commercialisation']));
clientRoutes.get('/', exigerPermission('clients', 'consultation'), clientController.lister);
clientRoutes.post('/', exigerPermission('clients', 'saisie'), clientController.creer);
clientRoutes.get('/:id', exigerPermission('clients', 'consultation'), clientController.consulter);
clientRoutes.patch('/:id', exigerPermission('clients', 'saisie'), clientController.modifier);
