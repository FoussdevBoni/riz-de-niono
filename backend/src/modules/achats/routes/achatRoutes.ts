import { Router } from 'express';

import {
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../http/middlewares/verificationSessionMiddleware.js';
import { achatController } from '../controllers/achatController.js';

/**
 * Routes montées sous /api/v1/achats (contrat : document 04). Module partagé par les trois activités :
 * le service contrôle l'activité de chaque achat et le site éventuel.
 */
export const achatRoutes = Router();

achatRoutes.use(verificationSessionMiddleware);
achatRoutes.get('/', exigerPermission('achats', 'consultation'), achatController.lister);
achatRoutes.post('/', exigerPermission('achats', 'saisie'), achatController.creer);
achatRoutes.get('/:id', exigerPermission('achats', 'consultation'), achatController.consulter);
achatRoutes.patch('/:id', exigerPermission('achats', 'saisie'), achatController.modifier);
achatRoutes.post('/:id/validation', exigerPermission('achats', 'validation'), achatController.valider);
achatRoutes.post('/:id/reception', exigerPermission('achats', 'validation'), achatController.receptionner);
achatRoutes.post('/:id/annulation', exigerPermission('achats', 'validation'), achatController.annuler);
