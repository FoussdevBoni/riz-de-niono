import { Router } from 'express';

import {
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../http/middlewares/verificationSessionMiddleware.js';
import { parametreEntrepriseController } from '../controllers/parametreEntrepriseController.js';

/** Routes montées sous /api/v1/parametres-entreprise (contrat : document 04). */
export const parametreEntrepriseRoutes = Router();

parametreEntrepriseRoutes.use(verificationSessionMiddleware);
parametreEntrepriseRoutes.get('/', exigerPermission('parametres_entreprise', 'consultation'), parametreEntrepriseController.consulter);
parametreEntrepriseRoutes.patch('/', exigerPermission('parametres_entreprise', 'administration'), parametreEntrepriseController.modifier);
