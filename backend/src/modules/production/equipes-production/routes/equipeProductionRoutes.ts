import { Router } from 'express';

import {
  exigerActivite,
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { equipeProductionController } from '../controllers/equipeProductionController.js';

/** Routes montées sous /api/v1/equipes-production (contrat : document 04). Activité Production. */
export const equipeProductionRoutes = Router();
const MODULE = 'equipes_production';

equipeProductionRoutes.use(verificationSessionMiddleware, exigerActivite('production'));
equipeProductionRoutes.get('/', exigerPermission(MODULE, 'consultation'), equipeProductionController.lister);
equipeProductionRoutes.post('/', exigerPermission(MODULE, 'saisie'), equipeProductionController.creer);
equipeProductionRoutes.get('/:id', exigerPermission(MODULE, 'consultation'), equipeProductionController.consulter);
equipeProductionRoutes.patch('/:id', exigerPermission(MODULE, 'saisie'), equipeProductionController.modifier);
