import { Router } from 'express';

import {
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../http/middlewares/verificationSessionMiddleware.js';
import { stockController } from '../controllers/stockController.js';

/**
 * Routes montées sous /api/v1/stock (contrat : document 04).
 * Le stock est global : son accès relève de la permission distincte du module stock.
 */
export const stockRoutes = Router();

stockRoutes.use(verificationSessionMiddleware);
stockRoutes.get('/', exigerPermission('stock', 'consultation'), stockController.lister);
