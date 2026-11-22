import type { Request, Response } from 'express';

import { lireSession } from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import {
  lireChaine,
  lireCode,
  lireCorps,
  lireDate,
  lireFiltreValeur,
  lireIdentifiant,
  lireListeObjectIds,
  obligatoire,
  type Donnees,
} from '../../../../http/validation/validationRequete.js';
import {
  campagneAgricoleService,
  STATUTS_CAMPAGNE,
  type DonneesCampagneAgricole,
} from '../services/campagneAgricoleService.js';

function lireDonnees(corps: unknown): DonneesCampagneAgricole {
  const donnees = lireCorps(corps);
  return {
    code: lireCode(donnees),
    nom: lireChaine(donnees, 'nom', { max: 100 }),
    date_debut: lireDate(donnees, 'date_debut'),
    date_fin: lireDate(donnees, 'date_fin'),
    site_ids: lireListeObjectIds(donnees, 'site_ids'),
  };
}

/** Contrôleur /campagnes-agricoles : lit la requête, appelle campagneAgricoleService et répond. */
export const campagneAgricoleController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    const filtres = { statut: lireFiltreValeur(query, 'statut', STATUTS_CAMPAGNE) };
    reponse.json(await campagneAgricoleService.lister(lireSession(reponse), filtres, pagination));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await campagneAgricoleService.consulter(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async proposerCode(requete: Request, reponse: Response) {
    const nom = typeof requete.query.nom === 'string' ? requete.query.nom.slice(0, 120) : undefined;
    reponse.json(await campagneAgricoleService.proposerCode(nom));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const campagne = await campagneAgricoleService.creer(lireSession(reponse), {
      ...donnees,
      nom: obligatoire(donnees.nom, 'nom'),
      date_debut: obligatoire(donnees.date_debut, 'date_debut'),
      date_fin: obligatoire(donnees.date_fin, 'date_fin'),
    });
    reponse.status(201).json(campagne);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await campagneAgricoleService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },

  async supprimer(requete: Request, reponse: Response) {
    await campagneAgricoleService.supprimer(lireSession(reponse), lireIdentifiant(requete.params.id));
    reponse.status(204).end();
  },

  async ouvrir(requete: Request, reponse: Response) {
    reponse.json(await campagneAgricoleService.ouvrir(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async cloturer(requete: Request, reponse: Response) {
    reponse.json(await campagneAgricoleService.cloturer(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },
};
