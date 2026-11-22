import type { Request, Response } from 'express';

import { lireSession } from '../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../http/pagination/paginationUtils.js';
import {
  lireBooleen,
  lireChaine,
  lireCode,
  lireCorps,
  lireFiltreBooleen,
  lireIdentifiant,
  obligatoire,
  type Donnees,
} from '../../../http/validation/validationRequete.js';
import { categorieProduitService, type DonneesCategorieProduit } from '../services/categorieProduitService.js';

function lireDonnees(corps: unknown): DonneesCategorieProduit {
  const donnees = lireCorps(corps);
  return {
    code: lireCode(donnees),
    nom: lireChaine(donnees, 'nom', { max: 100 }),
    actif: lireBooleen(donnees, 'actif'),
  };
}

/** Contrôleur /categories-produits : lit la requête, appelle categorieProduitService et répond. */
export const categorieProduitController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    reponse.json(await categorieProduitService.lister({ actif: lireFiltreBooleen(query, 'actif') }, pagination));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await categorieProduitService.consulter(lireIdentifiant(requete.params.id)));
  },

  async proposerCode(requete: Request, reponse: Response) {
    const nom = typeof requete.query.nom === 'string' ? requete.query.nom.slice(0, 120) : undefined;
    reponse.json(await categorieProduitService.proposerCode(nom));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const categorie = await categorieProduitService.creer(lireSession(reponse), {
      code: donnees.code,
      nom: obligatoire(donnees.nom, 'nom'),
    });
    reponse.status(201).json(categorie);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await categorieProduitService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },
};
