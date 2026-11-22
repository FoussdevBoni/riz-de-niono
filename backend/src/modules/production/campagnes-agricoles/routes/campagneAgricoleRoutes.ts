import { Router } from 'express';

import {
  exigerActivite,
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { campagneAgricoleController } from '../controllers/campagneAgricoleController.js';

/** Routes montées sous /api/v1/campagnes-agricoles (contrat : document 04). Activité Production. */
export const campagneAgricoleRoutes = Router();
const MODULE = 'campagnes_agricoles';

campagneAgricoleRoutes.use(verificationSessionMiddleware, exigerActivite('production'));
campagneAgricoleRoutes.get('/', exigerPermission(MODULE, 'consultation'), campagneAgricoleController.lister);
campagneAgricoleRoutes.get('/code-propose', exigerPermission(MODULE, 'saisie'), campagneAgricoleController.proposerCode);
campagneAgricoleRoutes.post('/', exigerPermission(MODULE, 'saisie'), campagneAgricoleController.creer);
campagneAgricoleRoutes.get('/:id', exigerPermission(MODULE, 'consultation'), campagneAgricoleController.consulter);
campagneAgricoleRoutes.delete('/:id', exigerPermission(MODULE, 'saisie'), campagneAgricoleController.supprimer);
campagneAgricoleRoutes.patch('/:id', exigerPermission(MODULE, 'saisie'), campagneAgricoleController.modifier);
campagneAgricoleRoutes.post('/:id/ouverture', exigerPermission(MODULE, 'validation'), campagneAgricoleController.ouvrir);
campagneAgricoleRoutes.post('/:id/cloture', exigerPermission(MODULE, 'cloture'), campagneAgricoleController.cloturer);
