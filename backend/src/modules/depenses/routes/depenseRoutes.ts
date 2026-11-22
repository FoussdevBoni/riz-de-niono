import { Router } from 'express';

import { lireFichierBrut } from '../../../http/middlewares/fichierBrutMiddleware.js';
import {
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../http/middlewares/verificationSessionMiddleware.js';
import { depenseController } from '../controllers/depenseController.js';

/**
 * Routes montées sous /api/v1/depenses (contrat : document 04). Module partagé : le service contrôle
 * l'activité et, en production, le site.
 */
export const depenseRoutes = Router();

depenseRoutes.use(verificationSessionMiddleware);
depenseRoutes.get('/', exigerPermission('depenses', 'consultation'), depenseController.lister);
depenseRoutes.post('/', exigerPermission('depenses', 'saisie'), depenseController.creer);
depenseRoutes.get('/:id', exigerPermission('depenses', 'consultation'), depenseController.consulter);
depenseRoutes.patch('/:id', exigerPermission('depenses', 'saisie'), depenseController.modifier);
depenseRoutes.post('/:id/validation', exigerPermission('depenses', 'validation'), depenseController.valider);
depenseRoutes.post('/:id/annulation', exigerPermission('depenses', 'validation'), depenseController.annuler);
// Justificatif : droits et statut contrôlés avant la lecture des octets (express.raw limité à cette route).
depenseRoutes.put(
  '/:id/justificatif',
  exigerPermission('depenses', 'saisie'),
  depenseController.verifierAvantJustificatif,
  lireFichierBrut,
  depenseController.joindreJustificatif,
);
depenseRoutes.delete('/:id/justificatif', exigerPermission('depenses', 'saisie'), depenseController.retirerJustificatif);
