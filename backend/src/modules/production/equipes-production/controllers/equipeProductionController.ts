import type { Request, Response } from 'express';

import { lireSession } from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import {
  lireBooleen,
  lireChaine,
  lireCorps,
  lireFiltreBooleen,
  lireIdentifiant,
  lireListeTextes,
  obligatoire,
  type Donnees,
} from '../../../../http/validation/validationRequete.js';
import { equipeProductionService, type DonneesEquipeProduction } from '../services/equipeProductionService.js';

function lireDonnees(corps: unknown): DonneesEquipeProduction {
  const donnees = lireCorps(corps);
  return {
    nom: lireChaine(donnees, 'nom', { max: 100 }),
    membres: lireListeTextes(donnees, 'membres'),
    actif: lireBooleen(donnees, 'actif'),
  };
}

/** Contrôleur /equipes-production : lit la requête, appelle equipeProductionService et répond. */
export const equipeProductionController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    reponse.json(await equipeProductionService.lister({ actif: lireFiltreBooleen(query, 'actif') }, pagination));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await equipeProductionService.consulter(lireIdentifiant(requete.params.id)));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const equipe = await equipeProductionService.creer(lireSession(reponse), {
      nom: obligatoire(donnees.nom, 'nom'),
      membres: donnees.membres,
    });
    reponse.status(201).json(equipe);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await equipeProductionService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },
};
