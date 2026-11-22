import { Router } from 'express';

import {
  exigerActivite,
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { siteProductionController } from '../controllers/siteProductionController.js';

/** Routes montées sous /api/v1/sites-production (contrat : document 04). Activité Production. */
export const siteProductionRoutes = Router();
const MODULE = 'sites_production';

siteProductionRoutes.use(verificationSessionMiddleware, exigerActivite('production'));
siteProductionRoutes.get('/', exigerPermission(MODULE, 'consultation'), siteProductionController.lister);
siteProductionRoutes.get('/code-propose', exigerPermission(MODULE, 'saisie'), siteProductionController.proposerCode);
siteProductionRoutes.post('/', exigerPermission(MODULE, 'saisie'), siteProductionController.creer);
siteProductionRoutes.get('/:id', exigerPermission(MODULE, 'consultation'), siteProductionController.consulter);
siteProductionRoutes.patch('/:id', exigerPermission(MODULE, 'saisie'), siteProductionController.modifier);
