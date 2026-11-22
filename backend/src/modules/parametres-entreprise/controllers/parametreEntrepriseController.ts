import type { Request, Response } from 'express';

import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { lireSession } from '../../../http/middlewares/verificationSessionMiddleware.js';
import { lireChaine, lireCorps, lireEffacable, lireEmail, type Donnees } from '../../../http/validation/validationRequete.js';
import { parametreEntrepriseService, type DonneesParametres } from '../services/parametreEntrepriseService.js';

const MOTIF_DEVISE = /^[A-Z]{3}$/;

function lireCoordonnees(donnees: Donnees): DonneesParametres['coordonnees'] {
  const valeur = donnees.coordonnees;
  if (valeur === undefined) return undefined;
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) {
    throw erreurs.donneesInvalides('Le champ coordonnees doit être un objet (adresse, telephone, email).', { champ: 'coordonnees' });
  }
  const coordonnees = valeur as Donnees;
  return {
    adresse: lireEffacable(coordonnees, 'adresse', (d, champ) => lireChaine(d, champ, { max: 300 })),
    telephone: lireEffacable(coordonnees, 'telephone', (d, champ) => lireChaine(d, champ, { max: 30 })),
    email: lireEffacable(coordonnees, 'email', lireEmail),
  };
}

/** Contrôleur /parametres-entreprise : lit la requête, appelle parametreEntrepriseService et répond. */
export const parametreEntrepriseController = {
  async consulter(_requete: Request, reponse: Response) {
    reponse.json(await parametreEntrepriseService.consulter());
  },

  async modifier(requete: Request, reponse: Response) {
    const donnees = lireCorps(requete.body);
    const devise = lireChaine(donnees, 'devise', { max: 3 })?.toUpperCase();
    if (devise !== undefined && !MOTIF_DEVISE.test(devise)) {
      throw erreurs.donneesInvalides('La devise est un code ISO 4217 de trois lettres, par exemple XOF.', { champ: 'devise' });
    }
    reponse.json(
      await parametreEntrepriseService.modifier(lireSession(reponse), {
        nom: lireChaine(donnees, 'nom', { max: 150 }),
        coordonnees: lireCoordonnees(donnees),
        devise,
      }),
    );
  },
};
