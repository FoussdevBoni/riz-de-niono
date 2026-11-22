import { Router } from 'express';

import {
  exigerPermission,
  exigerUneActivite,
  verificationSessionMiddleware,
} from '../../../http/middlewares/verificationSessionMiddleware.js';
import { venteController } from '../controllers/venteController.js';

/** Routes montées sous /api/v1/ventes (contrat : document 04). Utilisé en production et commercialisation. */
export const venteRoutes = Router();

venteRoutes.use(verificationSessionMiddleware, exigerUneActivite(['production', 'commercialisation']));
venteRoutes.get('/', exigerPermission('ventes', 'consultation'), venteController.lister);
venteRoutes.post('/', exigerPermission('ventes', 'saisie'), venteController.creer);
venteRoutes.get('/:id', exigerPermission('ventes', 'consultation'), venteController.consulter);
venteRoutes.patch('/:id', exigerPermission('ventes', 'saisie'), venteController.modifier);
venteRoutes.post('/:id/validation', exigerPermission('ventes', 'validation'), venteController.valider);
venteRoutes.post('/:id/annulation', exigerPermission('ventes', 'validation'), venteController.annuler);
