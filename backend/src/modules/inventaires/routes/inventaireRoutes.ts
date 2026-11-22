import { Router } from 'express';

import {
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../http/middlewares/verificationSessionMiddleware.js';
import { inventaireController } from '../controllers/inventaireController.js';

/**
 * Routes montées sous /api/v1/inventaires (contrat : document 04). Le stock étant global,
 * les inventaires sont communs aux trois activités et relèvent de la permission du module.
 */
export const inventaireRoutes = Router();
const MODULE = 'inventaires';

inventaireRoutes.use(verificationSessionMiddleware);
inventaireRoutes.get('/', exigerPermission(MODULE, 'consultation'), inventaireController.lister);
inventaireRoutes.post('/', exigerPermission(MODULE, 'saisie'), inventaireController.creer);
inventaireRoutes.get('/:id', exigerPermission(MODULE, 'consultation'), inventaireController.consulter);
inventaireRoutes.patch('/:id', exigerPermission(MODULE, 'saisie'), inventaireController.modifier);
inventaireRoutes.post('/:id/validation', exigerPermission(MODULE, 'validation'), inventaireController.valider);
inventaireRoutes.post('/:id/annulation', exigerPermission(MODULE, 'validation'), inventaireController.annuler);
