import { avecNomsProduits } from '../../../produits/services/nomsProduitsService.js';
import type { Request, Response } from 'express';

import { lireSession } from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import { lireLignesVente } from '../../../../http/validation/lignesVenteRequete.js';
import {
  lireChaine,
  lireCorps,
  lireDate,
  lireFiltreObjectId,
  lireFiltreValeur,
  lireIdentifiant,
  lireObjectId,
  obligatoire,
  type Donnees,
} from '../../../../http/validation/validationRequete.js';
import { commandeClientService, STATUTS_COMMANDE, type DonneesCommandeClient } from '../services/commandeClientService.js';

function lireDonnees(corps: unknown): DonneesCommandeClient {
  const donnees = lireCorps(corps);
  return {
    client_id: lireObjectId(donnees, 'client_id'),
    date_commande: lireDate(donnees, 'date_commande'),
    lignes: lireLignesVente(donnees),
  };
}

/** Contrôleur /commandes-clients : lit la requête, appelle commandeClientService et répond. */
export const commandeClientController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    const filtres = { client_id: lireFiltreObjectId(query, 'client_id'), statut: lireFiltreValeur(query, 'statut', STATUTS_COMMANDE) };
    reponse.json(await avecNomsProduits(await commandeClientService.lister(filtres, pagination)));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await avecNomsProduits(await commandeClientService.consulter(lireIdentifiant(requete.params.id))));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const commande = await commandeClientService.creer(lireSession(reponse), {
      client_id: obligatoire(donnees.client_id, 'client_id'),
      date_commande: obligatoire(donnees.date_commande, 'date_commande'),
      lignes: obligatoire(donnees.lignes, 'lignes'),
    });
    reponse.status(201).json(commande);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await commandeClientService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },

  async expedier(requete: Request, reponse: Response) {
    reponse.json(await commandeClientService.expedier(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  /** Corps vide accepté (document 04, exemple de livraison). Renvoie { commande, vente }. */
  async livrer(requete: Request, reponse: Response) {
    reponse.json(await commandeClientService.livrer(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  /** Le motif est facultatif pour une commande (le contrat ne l'exige pas). */
  async annuler(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    const corps = requete.body === undefined || requete.body === null ? {} : lireCorps(requete.body);
    reponse.json(await commandeClientService.annuler(lireSession(reponse), id, lireChaine(corps, 'motif', { max: 500 }) ?? null));
  },
};
