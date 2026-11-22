import type { ErrorRequestHandler, RequestHandler } from 'express';

import { ErreurApplication, erreurs } from '../erreurs/erreurApplication.js';

export const routeIntrouvableMiddleware: RequestHandler = (_requete, _reponse, suivant) => {
  suivant(erreurs.ressourceIntrouvable('Route introuvable.'));
};

export const gestionErreursMiddleware: ErrorRequestHandler = (erreur, _requete, reponse, _suivant) => {
  let erreurApplication: ErreurApplication;

  if (erreur instanceof ErreurApplication) {
    erreurApplication = erreur;
  } else if (erreur?.type === 'entity.parse.failed') {
    erreurApplication = erreurs.requeteIllisible('Le corps JSON est illisible.');
  } else {
    console.error(erreur);
    erreurApplication = new ErreurApplication(500, 'erreur_interne', 'Erreur interne du serveur.');
  }

  reponse.status(erreurApplication.statut).json({
    erreur: {
      code: erreurApplication.code,
      message: erreurApplication.message,
      ...(erreurApplication.details ? { details: erreurApplication.details } : {}),
    },
  });
};
