import type { RequestHandler, Response } from 'express';

import {
  authentificationService,
  type ContexteSession,
} from '../../modules/authentification/services/authentificationService.js';
import type { CodeAction, CodeModule } from '../../modules/roles/services/roleService.js';
import type { Activite } from '../../modules/utilisateurs/services/utilisateurService.js';
import { erreurs } from '../erreurs/erreurApplication.js';

/**
 * Vérifie le jeton « Authorization: Bearer » et place le contexte de session
 * dans reponse.locals.session pour les contrôleurs. La vérification elle-même
 * appartient au service Authentification.
 */
export const verificationSessionMiddleware: RequestHandler = async (requete, reponse, suivant) => {
  const [schema, jeton] = (requete.headers.authorization ?? '').split(' ');
  if (schema !== 'Bearer' || !jeton) {
    throw erreurs.sessionInvalide();
  }
  reponse.locals.session = await authentificationService.verifierSession(jeton);
  suivant();
};

/** Contexte de la session vérifiée par verificationSessionMiddleware. */
export function lireSession(reponse: Response): ContexteSession {
  const session = reponse.locals.session as ContexteSession | undefined;
  if (!session) throw erreurs.sessionInvalide();
  return session;
}

/** Refuse la requête (403) si l'activité ne fait pas partie du périmètre de l'utilisateur. */
export function exigerActivite(activite: Activite): RequestHandler {
  return (_requete, reponse, suivant) => {
    if (!lireSession(reponse).activites.includes(activite)) {
      throw erreurs.accesRefuse(`Votre périmètre n'inclut pas l'activité ${activite}.`);
    }
    suivant();
  };
}

/** Refuse la requête (403) si aucune de ces activités ne fait partie du périmètre (modules partagés). */
export function exigerUneActivite(activites: readonly Activite[]): RequestHandler {
  return (_requete, reponse, suivant) => {
    if (!activites.some((activite) => lireSession(reponse).activites.includes(activite))) {
      throw erreurs.accesRefuse(`Votre périmètre n'inclut aucune des activités : ${activites.join(', ')}.`);
    }
    suivant();
  };
}

/** Refuse la requête (403) si le rôle de la session n'a pas la permission module + action. */
export function exigerPermission(module: CodeModule, action: CodeAction): RequestHandler {
  return (_requete, reponse, suivant) => {
    if (!authentificationService.possedePermission(lireSession(reponse), module, action)) {
      throw erreurs.accesRefuse();
    }
    suivant();
  };
}
