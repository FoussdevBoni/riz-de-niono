import { Router } from 'express';

import { verificationSessionMiddleware } from '../../../http/middlewares/verificationSessionMiddleware.js';
import { authentificationController } from '../controllers/authentificationController.js';

/** Routes montées sous /api/v1/auth (contrat : document 04). Seule la déconnexion exige une session. */
export const authentificationRoutes = Router();

authentificationRoutes.post('/connexion', authentificationController.connecter);
authentificationRoutes.post('/deconnexion', verificationSessionMiddleware, authentificationController.deconnecter);
authentificationRoutes.post('/reinitialisation', authentificationController.demanderReinitialisation);
authentificationRoutes.post('/reinitialisation/confirmation', authentificationController.confirmerReinitialisation);
