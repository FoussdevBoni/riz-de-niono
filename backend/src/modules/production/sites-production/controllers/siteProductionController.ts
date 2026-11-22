import type { Request, Response } from 'express';

import { lireSession } from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import {
  lireBooleen,
  lireChaine,
  lireCode,
  lireCorps,
  lireDecimal,
  lireEffacable,
  lireFiltreBooleen,
  lireIdentifiant,
  lireObjectId,
  obligatoire,
  type Donnees,
} from '../../../../http/validation/validationRequete.js';
import { siteProductionService, type DonneesSiteProduction } from '../services/siteProductionService.js';

function lireDonnees(corps: unknown): DonneesSiteProduction {
  const donnees = lireCorps(corps);
  return {
    code: lireCode(donnees),
    nom: lireChaine(donnees, 'nom', { max: 100 }),
    localisation: lireEffacable(donnees, 'localisation', (d, champ) => lireChaine(d, champ, { max: 200 })),
    superficie_ha: lireEffacable(donnees, 'superficie_ha', lireDecimal),
    responsable_id: lireEffacable(donnees, 'responsable_id', lireObjectId),
    actif: lireBooleen(donnees, 'actif'),
  };
}

/** Contrôleur /sites-production : lit la requête, appelle siteProductionService et répond. */
export const siteProductionController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    reponse.json(
      await siteProductionService.lister(lireSession(reponse), { actif: lireFiltreBooleen(query, 'actif') }, pagination),
    );
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await siteProductionService.consulter(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async proposerCode(requete: Request, reponse: Response) {
    const nom = typeof requete.query.nom === 'string' ? requete.query.nom.slice(0, 120) : undefined;
    reponse.json(await siteProductionService.proposerCode(nom));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const site = await siteProductionService.creer(lireSession(reponse), {
      ...donnees,
      nom: obligatoire(donnees.nom, 'nom'),
    });
    reponse.status(201).json(site);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await siteProductionService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },
};
