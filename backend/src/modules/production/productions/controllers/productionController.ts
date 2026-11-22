import { avecNomsProduits } from '../../../produits/services/nomsProduitsService.js';
import type { Request, Response } from 'express';

import { lireSession } from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import {
  lireCorps,
  lireDate,
  lireDecimal,
  lireFiltreObjectId,
  lireFiltreValeur,
  lireIdentifiant,
  lireMotif,
  lireObjectId,
  lireQuantite,
  obligatoire,
  type Donnees,
} from '../../../../http/validation/validationRequete.js';
import { productionService, STATUTS_OPERATION, type DonneesProduction } from '../services/productionService.js';

function lireDonnees(corps: unknown): DonneesProduction {
  const donnees = lireCorps(corps);
  return {
    campagne_id: lireObjectId(donnees, 'campagne_id'),
    site_id: lireObjectId(donnees, 'site_id'),
    produit_id: lireObjectId(donnees, 'produit_id'),
    date_recolte: lireDate(donnees, 'date_recolte'),
    // Une superficie nulle est admise : le rendement s'affiche alors « indisponible » (document 02).
    superficie_recoltee_ha: lireDecimal(donnees, 'superficie_recoltee_ha'),
    quantite: lireQuantite(donnees, 'quantite'),
  };
}

/** Contrôleur /productions : lit la requête, appelle productionService et répond. */
export const productionController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    const filtres = {
      campagne_id: lireFiltreObjectId(query, 'campagne_id'),
      site_id: lireFiltreObjectId(query, 'site_id'),
      statut: lireFiltreValeur(query, 'statut', STATUTS_OPERATION),
    };
    reponse.json(await avecNomsProduits(await productionService.lister(lireSession(reponse), filtres, pagination)));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await avecNomsProduits(await productionService.consulter(lireSession(reponse), lireIdentifiant(requete.params.id))));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const production = await productionService.creer(lireSession(reponse), {
      campagne_id: obligatoire(donnees.campagne_id, 'campagne_id'),
      site_id: obligatoire(donnees.site_id, 'site_id'),
      produit_id: obligatoire(donnees.produit_id, 'produit_id'),
      date_recolte: obligatoire(donnees.date_recolte, 'date_recolte'),
      superficie_recoltee_ha: obligatoire(donnees.superficie_recoltee_ha, 'superficie_recoltee_ha'),
      quantite: obligatoire(donnees.quantite, 'quantite'),
    });
    reponse.status(201).json(production);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await productionService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },

  async valider(requete: Request, reponse: Response) {
    reponse.json(await productionService.valider(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async annuler(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await productionService.annuler(lireSession(reponse), id, lireMotif(requete.body)));
  },
};
