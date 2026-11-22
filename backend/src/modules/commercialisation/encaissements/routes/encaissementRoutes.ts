import { Router } from 'express';

import {
  exigerPermission,
  exigerUneActivite,
  verificationSessionMiddleware,
} from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { encaissementController } from '../controllers/encaissementController.js';

/**
 * Routes montées sous /api/v1/encaissements (contrat : document 04). Un encaissement suit la visibilité
 * de sa vente (production ou commercialisation).
 */
export const encaissementRoutes = Router();
const MODULE = 'encaissements';

encaissementRoutes.use(verificationSessionMiddleware, exigerUneActivite(['production', 'commercialisation']));
encaissementRoutes.get('/', exigerPermission(MODULE, 'consultation'), encaissementController.lister);
encaissementRoutes.post('/', exigerPermission(MODULE, 'saisie'), encaissementController.creer);
encaissementRoutes.get('/:id', exigerPermission(MODULE, 'consultation'), encaissementController.consulter);
encaissementRoutes.patch('/:id', exigerPermission(MODULE, 'saisie'), encaissementController.modifier);
encaissementRoutes.post('/:id/validation', exigerPermission(MODULE, 'validation'), encaissementController.valider);
encaissementRoutes.post('/:id/annulation', exigerPermission(MODULE, 'validation'), encaissementController.annuler);
