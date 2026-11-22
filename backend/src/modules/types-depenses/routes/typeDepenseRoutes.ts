import { Router } from 'express';

import {
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../http/middlewares/verificationSessionMiddleware.js';
import { typeDepenseController } from '../controllers/typeDepenseController.js';

/** Routes montées sous /api/v1/types-depenses (contrat : document 04). Référentiel commun aux activités. */
export const typeDepenseRoutes = Router();

typeDepenseRoutes.use(verificationSessionMiddleware);
typeDepenseRoutes.get('/', exigerPermission('types_depenses', 'consultation'), typeDepenseController.lister);
typeDepenseRoutes.get('/code-propose', exigerPermission('types_depenses', 'saisie'), typeDepenseController.proposerCode);
typeDepenseRoutes.post('/', exigerPermission('types_depenses', 'saisie'), typeDepenseController.creer);
typeDepenseRoutes.get('/:id', exigerPermission('types_depenses', 'consultation'), typeDepenseController.consulter);
typeDepenseRoutes.patch('/:id', exigerPermission('types_depenses', 'saisie'), typeDepenseController.modifier);
