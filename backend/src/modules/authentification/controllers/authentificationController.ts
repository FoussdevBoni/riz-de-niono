import type { Request, Response } from 'express';

import { lireSession } from '../../../http/middlewares/verificationSessionMiddleware.js';
import {
  lireChaine,
  lireCorps,
  lireEmail,
  lireMotDePasse,
  obligatoire,
} from '../../../http/validation/validationRequete.js';
import { authentificationService } from '../services/authentificationService.js';

/** Contrôleur /auth : lit la requête, appelle authentificationService et produit la réponse HTTP. */
export const authentificationController = {
  async connecter(requete: Request, reponse: Response) {
    const donnees = lireCorps(requete.body);
    const resultat = await authentificationService.connecter(
      obligatoire(lireEmail(donnees), 'email'),
      obligatoire(lireMotDePasse(donnees, 'mot_de_passe'), 'mot_de_passe'),
    );
    reponse.json(resultat);
  },

  async deconnecter(_requete: Request, reponse: Response) {
    await authentificationService.deconnecter(lireSession(reponse));
    reponse.status(204).end();
  },

  async demanderReinitialisation(requete: Request, reponse: Response) {
    const donnees = lireCorps(requete.body);
    // Non attendu : la réponse ne dépend ni de l'existence du compte ni de l'envoi de l'e-mail.
    void authentificationService.demanderReinitialisation(obligatoire(lireEmail(donnees), 'email'));
    reponse.status(202).end();
  },

  async confirmerReinitialisation(requete: Request, reponse: Response) {
    const donnees = lireCorps(requete.body);
    await authentificationService.confirmerReinitialisation(
      obligatoire(lireChaine(donnees, 'jeton', { max: 200 }), 'jeton'),
      obligatoire(lireMotDePasse(donnees, 'nouveau_mot_de_passe'), 'nouveau_mot_de_passe'),
    );
    reponse.status(204).end();
  },
};
