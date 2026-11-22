import type { Request, Response } from 'express';

import { lireSession } from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import {
  lireChaine,
  lireCorps,
  lireDate,
  lireEffacable,
  lireFiltreObjectId,
  lireIdentifiant,
  lireObjectId,
  lireQuantite,
  obligatoire,
  type Donnees,
} from '../../../../http/validation/validationRequete.js';
import { cultureService, type DonneesCulture } from '../services/cultureService.js';

function lireDonnees(corps: unknown): DonneesCulture {
  const donnees = lireCorps(corps);
  return {
    campagne_id: lireObjectId(donnees, 'campagne_id'),
    site_id: lireObjectId(donnees, 'site_id'),
    culture: lireChaine(donnees, 'culture', { max: 100 }),
    variete: lireEffacable(donnees, 'variete', (d, champ) => lireChaine(d, champ, { max: 100 })),
    superficie_ha: lireQuantite(donnees, 'superficie_ha'),
    date_semis: lireEffacable(donnees, 'date_semis', lireDate),
  };
}

/** Contrôleur /cultures : lit la requête, appelle cultureService et répond. */
export const cultureController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    const filtres = { campagne_id: lireFiltreObjectId(query, 'campagne_id'), site_id: lireFiltreObjectId(query, 'site_id') };
    reponse.json(await cultureService.lister(lireSession(reponse), filtres, pagination));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await cultureService.consulter(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const culture = await cultureService.creer(lireSession(reponse), {
      ...donnees,
      campagne_id: obligatoire(donnees.campagne_id, 'campagne_id'),
      site_id: obligatoire(donnees.site_id, 'site_id'),
      culture: obligatoire(donnees.culture, 'culture'),
      superficie_ha: obligatoire(donnees.superficie_ha, 'superficie_ha'),
    });
    reponse.status(201).json(culture);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await cultureService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },
};
