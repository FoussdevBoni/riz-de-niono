import { Router } from 'express';

import {
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../http/middlewares/verificationSessionMiddleware.js';
import { mouvementStockController } from '../controllers/mouvementStockController.js';

/** Routes montées sous /api/v1/mouvements-stock (contrat : document 04). */
export const mouvementStockRoutes = Router();

mouvementStockRoutes.use(verificationSessionMiddleware);
mouvementStockRoutes.get('/', exigerPermission('stock', 'consultation'), mouvementStockController.lister);
mouvementStockRoutes.get('/:id', exigerPermission('stock', 'consultation'), mouvementStockController.consulter);
mouvementStockRoutes.post('/:id/correction', exigerPermission('stock', 'validation'), mouvementStockController.corriger);
