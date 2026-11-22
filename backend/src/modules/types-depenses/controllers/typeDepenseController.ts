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
import { typeDepenseService, type DonneesTypeDepense } from '../services/typeDepenseService.js';

function lireDonnees(corps: unknown): DonneesTypeDepense {
  const donnees = lireCorps(corps);
  return {
    code: lireCode(donnees),
    nom: lireChaine(donnees, 'nom', { max: 100 }),
    actif: lireBooleen(donnees, 'actif'),
  };
}

/** Contrôleur /types-depenses : lit la requête, appelle typeDepenseService et répond. */
export const typeDepenseController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    reponse.json(await typeDepenseService.lister({ actif: lireFiltreBooleen(query, 'actif') }, pagination));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await typeDepenseService.consulter(lireIdentifiant(requete.params.id)));
  },

  async proposerCode(requete: Request, reponse: Response) {
    const nom = typeof requete.query.nom === 'string' ? requete.query.nom.slice(0, 120) : undefined;
    reponse.json(await typeDepenseService.proposerCode(nom));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const categorie = await typeDepenseService.creer(lireSession(reponse), {
      code: donnees.code,
      nom: obligatoire(donnees.nom, 'nom'),
    });
    reponse.status(201).json(categorie);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await typeDepenseService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },
};
