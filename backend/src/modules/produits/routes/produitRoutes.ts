import { Router } from 'express';

import {
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../http/middlewares/verificationSessionMiddleware.js';
import { produitController } from '../controllers/produitController.js';

/** Routes montées sous /api/v1/produits (contrat : document 04). Référentiel partagé ; filtrage par activité dans le service. */
export const produitRoutes = Router();

produitRoutes.use(verificationSessionMiddleware);
produitRoutes.get('/', exigerPermission('produits', 'consultation'), produitController.lister);
produitRoutes.get('/code-propose', exigerPermission('produits', 'saisie'), produitController.proposerCode);
produitRoutes.post('/', exigerPermission('produits', 'saisie'), produitController.creer);
produitRoutes.get('/:id', exigerPermission('produits', 'consultation'), produitController.consulter);
produitRoutes.patch('/:id', exigerPermission('produits', 'saisie'), produitController.modifier);
