import type { NextFunction, Request, Response } from 'express';

import { configuration } from '../../config/configuration.js';

/**
 * Autorise les appels du frontend hébergé sur un autre domaine (Firebase Hosting → Render).
 * Seules les origines déclarées dans ORIGINES_AUTORISEES reçoivent les en-têtes CORS ; la session
 * passe par l'en-tête Authorization (jeton), sans cookie.
 */
export function originesMiddleware(requete: Request, reponse: Response, suivant: NextFunction): void {
  const origine = requete.headers.origin;
  if (origine && configuration.originesAutorisees.includes(origine)) {
    reponse.setHeader('Access-Control-Allow-Origin', origine);
    reponse.setHeader('Vary', 'Origin');
    reponse.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    reponse.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    reponse.setHeader('Access-Control-Max-Age', '600');
  }
  if (requete.method === 'OPTIONS') {
    reponse.status(204).end();
    return;
  }
  suivant();
}
