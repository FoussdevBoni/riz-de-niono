import { Router } from 'express';

import {
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../http/middlewares/verificationSessionMiddleware.js';
import { fournisseurController } from '../controllers/fournisseurController.js';

/** Routes montées sous /api/v1/fournisseurs (contrat : document 04). Référentiel commun aux activités. */
export const fournisseurRoutes = Router();

fournisseurRoutes.use(verificationSessionMiddleware);
fournisseurRoutes.get('/', exigerPermission('fournisseurs', 'consultation'), fournisseurController.lister);
fournisseurRoutes.post('/', exigerPermission('fournisseurs', 'saisie'), fournisseurController.creer);
fournisseurRoutes.get('/:id', exigerPermission('fournisseurs', 'consultation'), fournisseurController.consulter);
fournisseurRoutes.patch('/:id', exigerPermission('fournisseurs', 'saisie'), fournisseurController.modifier);
