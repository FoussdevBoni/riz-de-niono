import { Router } from 'express';

import {
  exigerPermission,
  verificationSessionMiddleware,
} from '../../../http/middlewares/verificationSessionMiddleware.js';
import { journalOperationController } from '../controllers/journalOperationController.js';

/** Routes montées sous /api/v1/journal-operations (contrat : document 04). Lecture seule. */
export const journalOperationRoutes = Router();

journalOperationRoutes.use(verificationSessionMiddleware, exigerPermission('journal_operations', 'consultation'));
journalOperationRoutes.get('/', journalOperationController.lister);
journalOperationRoutes.get('/:id', journalOperationController.consulter);
