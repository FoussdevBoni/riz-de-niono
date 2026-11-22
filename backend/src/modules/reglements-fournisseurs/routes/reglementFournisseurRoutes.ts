import { Router } from 'express';

import {
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../http/middlewares/verificationSessionMiddleware.js';
import { reglementFournisseurController } from '../controllers/reglementFournisseurController.js';

/** Routes montées sous /api/v1/reglements-fournisseurs (contrat : document 04). Module partagé par les activités. */
export const reglementFournisseurRoutes = Router();
const MODULE = 'reglements_fournisseurs';

reglementFournisseurRoutes.use(verificationSessionMiddleware);
reglementFournisseurRoutes.get('/', exigerPermission(MODULE, 'consultation'), reglementFournisseurController.lister);
reglementFournisseurRoutes.post('/', exigerPermission(MODULE, 'saisie'), reglementFournisseurController.creer);
reglementFournisseurRoutes.get('/:id', exigerPermission(MODULE, 'consultation'), reglementFournisseurController.consulter);
reglementFournisseurRoutes.patch('/:id', exigerPermission(MODULE, 'saisie'), reglementFournisseurController.modifier);
reglementFournisseurRoutes.post('/:id/validation', exigerPermission(MODULE, 'validation'), reglementFournisseurController.valider);
reglementFournisseurRoutes.post('/:id/annulation', exigerPermission(MODULE, 'validation'), reglementFournisseurController.annuler);
