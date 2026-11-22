import { Router } from 'express';

import {
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../http/middlewares/verificationSessionMiddleware.js';
import { materielController } from '../controllers/materielController.js';

/** Routes montées sous /api/v1/materiels (contrat : document 04). Partagé ; filtrage par activité dans le service. */
export const materielRoutes = Router();

materielRoutes.use(verificationSessionMiddleware);
materielRoutes.get('/', exigerPermission('materiels', 'consultation'), materielController.lister);
materielRoutes.get('/code-propose', exigerPermission('materiels', 'saisie'), materielController.proposerCode);
materielRoutes.post('/', exigerPermission('materiels', 'saisie'), materielController.creer);
materielRoutes.get('/:id', exigerPermission('materiels', 'consultation'), materielController.consulter);
materielRoutes.patch('/:id', exigerPermission('materiels', 'saisie'), materielController.modifier);
