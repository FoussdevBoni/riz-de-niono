import { Router } from 'express';

import {
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../http/middlewares/verificationSessionMiddleware.js';
import { categorieProduitController } from '../controllers/categorieProduitController.js';

/** Routes montées sous /api/v1/categories-produits (contrat : document 04). Référentiel commun aux activités. */
export const categorieProduitRoutes = Router();

categorieProduitRoutes.use(verificationSessionMiddleware);
categorieProduitRoutes.get('/', exigerPermission('categories_produits', 'consultation'), categorieProduitController.lister);
categorieProduitRoutes.get('/code-propose', exigerPermission('categories_produits', 'saisie'), categorieProduitController.proposerCode);
categorieProduitRoutes.post('/', exigerPermission('categories_produits', 'saisie'), categorieProduitController.creer);
categorieProduitRoutes.get('/:id', exigerPermission('categories_produits', 'consultation'), categorieProduitController.consulter);
categorieProduitRoutes.patch('/:id', exigerPermission('categories_produits', 'saisie'), categorieProduitController.modifier);
