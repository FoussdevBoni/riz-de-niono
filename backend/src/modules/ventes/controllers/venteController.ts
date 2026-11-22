import { avecNomsProduits } from '../../produits/services/nomsProduitsService.js';
import type { Request, Response } from 'express';

import { lireSession } from '../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../http/pagination/paginationUtils.js';
import { lireLignesVente } from '../../../http/validation/lignesVenteRequete.js';
import {
  lireCorps,
  lireDate,
  lireFiltreObjectId,
  lireFiltreValeur,
  lireIdentifiant,
  lireListeValeurs,
  lireMotif,
  lireObjectId,
  obligatoire,
  type Donnees,
} from '../../../http/validation/validationRequete.js';
import { ACTIVITES_VENTE, STATUTS_OPERATION, venteService, type DonneesVente } from '../services/venteService.js';

function lireDonnees(corps: unknown): DonneesVente {
  const donnees = lireCorps(corps);
  const activite = lireListeValeurs({ activite: donnees.activite === undefined ? undefined : [donnees.activite] }, 'activite', ACTIVITES_VENTE);
  return {
    client_id: lireObjectId(donnees, 'client_id'),
    activite: activite?.[0],
    date_vente: lireDate(donnees, 'date_vente'),
    lignes: lireLignesVente(donnees),
  };
}

/** Contrôleur /ventes : lit la requête, appelle venteService et répond. */
export const venteController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    const filtres = {
      client_id: lireFiltreObjectId(query, 'client_id'),
      activite: lireFiltreValeur(query, 'activite', ACTIVITES_VENTE),
      commande_id: lireFiltreObjectId(query, 'commande_id'),
      statut: lireFiltreValeur(query, 'statut', STATUTS_OPERATION),
    };
    reponse.json(await avecNomsProduits(await venteService.lister(lireSession(reponse), filtres, pagination)));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await avecNomsProduits(await venteService.consulter(lireSession(reponse), lireIdentifiant(requete.params.id))));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const vente = await venteService.creer(lireSession(reponse), {
      client_id: obligatoire(donnees.client_id, 'client_id'),
      activite: obligatoire(donnees.activite, 'activite'),
      date_vente: obligatoire(donnees.date_vente, 'date_vente'),
      lignes: obligatoire(donnees.lignes, 'lignes'),
    });
    reponse.status(201).json(vente);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await venteService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },

  async valider(requete: Request, reponse: Response) {
    reponse.json(await venteService.valider(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async annuler(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await venteService.annuler(lireSession(reponse), id, lireMotif(requete.body)));
  },
};
