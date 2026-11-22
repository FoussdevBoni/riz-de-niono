import type { Request, Response } from 'express';

import { lireSession } from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import {
  lireBooleen,
  lireChaine,
  lireCode,
  lireCorps,
  lireEffacable,
  lireFiltreBooleen,
  lireIdentifiant,
  obligatoire,
  type Donnees,
} from '../../../../http/validation/validationRequete.js';
import { uniteTransformationService, type DonneesUniteTransformation } from '../services/uniteTransformationService.js';

function lireDonnees(corps: unknown): DonneesUniteTransformation {
  const donnees = lireCorps(corps);
  return {
    code: lireCode(donnees),
    nom: lireChaine(donnees, 'nom', { max: 100 }),
    localisation: lireEffacable(donnees, 'localisation', (d, champ) => lireChaine(d, champ, { max: 200 })),
    actif: lireBooleen(donnees, 'actif'),
  };
}

/** Contrôleur /unites-transformation : lit la requête, appelle uniteTransformationService et répond. */
export const uniteTransformationController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    reponse.json(await uniteTransformationService.lister({ actif: lireFiltreBooleen(query, 'actif') }, pagination));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await uniteTransformationService.consulter(lireIdentifiant(requete.params.id)));
  },

  async proposerCode(requete: Request, reponse: Response) {
    const nom = typeof requete.query.nom === 'string' ? requete.query.nom.slice(0, 120) : undefined;
    reponse.json(await uniteTransformationService.proposerCode(nom));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const unite = await uniteTransformationService.creer(lireSession(reponse), {
      code: donnees.code,
      nom: obligatoire(donnees.nom, 'nom'),
      localisation: donnees.localisation,
    });
    reponse.status(201).json(unite);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await uniteTransformationService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },
};
