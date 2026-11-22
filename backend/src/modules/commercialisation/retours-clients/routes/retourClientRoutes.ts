import { Router } from 'express';

import {
  exigerPermission,
  exigerUneActivite,
  verificationSessionMiddleware,
} from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { retourClientController } from '../controllers/retourClientController.js';

/** Routes montées sous /api/v1/retours-clients (contrat : document 04). Un retour suit la visibilité de sa vente. */
export const retourClientRoutes = Router();
const MODULE = 'retours_clients';

retourClientRoutes.use(verificationSessionMiddleware, exigerUneActivite(['production', 'commercialisation']));
retourClientRoutes.get('/', exigerPermission(MODULE, 'consultation'), retourClientController.lister);
retourClientRoutes.post('/', exigerPermission(MODULE, 'saisie'), retourClientController.creer);
retourClientRoutes.get('/:id', exigerPermission(MODULE, 'consultation'), retourClientController.consulter);
retourClientRoutes.patch('/:id', exigerPermission(MODULE, 'saisie'), retourClientController.modifier);
retourClientRoutes.post('/:id/validation', exigerPermission(MODULE, 'validation'), retourClientController.valider);
retourClientRoutes.post('/:id/annulation', exigerPermission(MODULE, 'validation'), retourClientController.annuler);
