import { Router } from 'express';

import { verificationSessionMiddleware } from '../../../http/middlewares/verificationSessionMiddleware.js';
import { profilController } from '../controllers/profilController.js';

/** Routes montées sous /api/v1/profil (contrat : document 04). Une session valide suffit. */
export const profilRoutes = Router();

profilRoutes.use(verificationSessionMiddleware);
profilRoutes.get('/', profilController.consulter);
profilRoutes.patch('/', profilController.modifier);
profilRoutes.post('/mot-de-passe', profilController.changerMotDePasse);
