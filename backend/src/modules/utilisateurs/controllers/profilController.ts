import type { Request, Response } from 'express';

import { lireSession } from '../../../http/middlewares/verificationSessionMiddleware.js';
import { lireChaine, lireCorps, lireMotDePasse, obligatoire } from '../../../http/validation/validationRequete.js';
import { utilisateurService } from '../services/utilisateurService.js';

/** Contrôleur /profil : agit toujours sur l'utilisateur de la session, sans permission de module. */
export const profilController = {
  async consulter(_requete: Request, reponse: Response) {
    reponse.json(await utilisateurService.lireProfil(lireSession(reponse).utilisateur_id!));
  },

  async modifier(requete: Request, reponse: Response) {
    const donnees = lireCorps(requete.body);
    reponse.json(
      await utilisateurService.modifierProfil(lireSession(reponse), { nom: lireChaine(donnees, 'nom', { max: 100 }) }),
    );
  },

  async changerMotDePasse(requete: Request, reponse: Response) {
    const donnees = lireCorps(requete.body);
    await utilisateurService.changerMotDePasse(
      lireSession(reponse),
      obligatoire(lireMotDePasse(donnees, 'mot_de_passe_actuel'), 'mot_de_passe_actuel'),
      obligatoire(lireMotDePasse(donnees, 'nouveau_mot_de_passe'), 'nouveau_mot_de_passe'),
    );
    reponse.status(204).end();
  },
};
