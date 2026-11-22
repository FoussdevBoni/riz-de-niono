import { Router } from 'express';

import {
  exigerActivite,
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { commandeClientController } from '../controllers/commandeClientController.js';

/** Routes montées sous /api/v1/commandes-clients (contrat : document 04). Activité Commercialisation. */
export const commandeClientRoutes = Router();
const MODULE = 'commandes_clients';

commandeClientRoutes.use(verificationSessionMiddleware, exigerActivite('commercialisation'));
commandeClientRoutes.get('/', exigerPermission(MODULE, 'consultation'), commandeClientController.lister);
commandeClientRoutes.post('/', exigerPermission(MODULE, 'saisie'), commandeClientController.creer);
commandeClientRoutes.get('/:id', exigerPermission(MODULE, 'consultation'), commandeClientController.consulter);
commandeClientRoutes.patch('/:id', exigerPermission(MODULE, 'saisie'), commandeClientController.modifier);
commandeClientRoutes.post('/:id/expedition', exigerPermission(MODULE, 'validation'), commandeClientController.expedier);
commandeClientRoutes.post('/:id/livraison', exigerPermission(MODULE, 'validation'), commandeClientController.livrer);
commandeClientRoutes.post('/:id/annulation', exigerPermission(MODULE, 'validation'), commandeClientController.annuler);
