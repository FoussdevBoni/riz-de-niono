import express from 'express';

import { configuration } from './config/configuration.js';
import { apiRouter } from './http/apiRouter.js';
import { originesMiddleware } from './http/middlewares/originesMiddleware.js';
import {
  gestionErreursMiddleware,
  routeIntrouvableMiddleware,
} from './http/middlewares/gestionErreursMiddleware.js';

export function creerApplication(): express.Express {
  const application = express();

  application.disable('x-powered-by');
  // Derrière le proxy de l'hébergeur (Render), pour l'adresse réelle du client.
  application.set('trust proxy', 1);
  application.use(originesMiddleware);
  // Contrôle de disponibilité de l'hébergeur, sans session ni accès à la base.
  application.get(`${configuration.prefixeApi}/sante`, (_requete, reponse) => {
    reponse.json({ statut: 'ok' });
  });
  application.use(express.json({ limit: '1mb' }));
  application.use(configuration.prefixeApi, apiRouter);
  application.use(routeIntrouvableMiddleware);
  application.use(gestionErreursMiddleware);

  return application;
}
