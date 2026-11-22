/**
 * Erreur renvoyée au client au format commun du document 04 :
 * {"erreur":{"code":"...","message":"...","details":{...}}}
 * Les services lèvent ces erreurs ; le middleware de gestion des erreurs les formate.
 */
export class ErreurApplication extends Error {
  constructor(
    readonly statut: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ErreurApplication';
  }
}

export const erreurs = {
  requeteIllisible: (message = 'Requête illisible.') =>
    new ErreurApplication(400, 'requete_illisible', message),
  sessionInvalide: (message = 'Session invalide ou expirée.') =>
    new ErreurApplication(401, 'session_invalide', message),
  accesRefuse: (message = 'Accès refusé.') => new ErreurApplication(403, 'acces_refuse', message),
  ressourceIntrouvable: (message = 'Ressource introuvable.') =>
    new ErreurApplication(404, 'ressource_introuvable', message),
  conflit: (code: string, message: string, details?: Record<string, unknown>) =>
    new ErreurApplication(409, code, message, details),
  donneesInvalides: (message: string, details?: Record<string, unknown>, code = 'donnees_invalides') =>
    new ErreurApplication(422, code, message, details),
};
