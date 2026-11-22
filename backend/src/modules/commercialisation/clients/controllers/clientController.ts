import type { Request, Response } from 'express';

import { lireSession } from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import {
  lireBooleen,
  lireChaine,
  lireCorps,
  lireEffacable,
  lireFiltreBooleen,
  lireIdentifiant,
  obligatoire,
  type Donnees,
} from '../../../../http/validation/validationRequete.js';
import { clientService, type DonneesClient } from '../services/clientService.js';

function lireDonnees(corps: unknown): DonneesClient {
  const donnees = lireCorps(corps);
  return {
    nom: lireChaine(donnees, 'nom', { max: 150 }),
    telephone: lireEffacable(donnees, 'telephone', (d, champ) => lireChaine(d, champ, { max: 30 })),
    adresse: lireEffacable(donnees, 'adresse', (d, champ) => lireChaine(d, champ, { max: 300 })),
    actif: lireBooleen(donnees, 'actif'),
  };
}

/** Contrôleur /clients : lit la requête, appelle clientService et répond. */
export const clientController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    reponse.json(await clientService.lister({ actif: lireFiltreBooleen(query, 'actif') }, pagination));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await clientService.consulter(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const client = await clientService.creer(lireSession(reponse), { ...donnees, nom: obligatoire(donnees.nom, 'nom') });
    reponse.status(201).json(client);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await clientService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },
};
