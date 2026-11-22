import type { Request, Response } from 'express';

import { lireSession } from '../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../http/pagination/paginationUtils.js';
import {
  lireBooleen,
  lireChaine,
  lireCode,
  lireCorps,
  lireDecimal,
  lireEffacable,
  lireFiltreObjectId,
  lireFiltreValeur,
  lireIdentifiant,
  lireListeValeurs,
  lireObjectId,
  obligatoire,
  type Donnees,
} from '../../../http/validation/validationRequete.js';
import { ACTIVITES } from '../../utilisateurs/services/utilisateurService.js';
import { produitService, type DonneesProduit } from '../services/produitService.js';

function lireDonnees(corps: unknown): DonneesProduit {
  const donnees = lireCorps(corps);
  return {
    code: lireCode(donnees),
    nom: lireChaine(donnees, 'nom', { max: 100 }),
    categorie_id: lireObjectId(donnees, 'categorie_id'),
    unite_stock: lireChaine(donnees, 'unite_stock', { max: 20 }),
    activites: lireListeValeurs(donnees, 'activites', ACTIVITES),
    stockable: lireBooleen(donnees, 'stockable'),
    prix_vente: lireEffacable(donnees, 'prix_vente', lireDecimal),
    actif: lireBooleen(donnees, 'actif'),
  };
}

/** Contrôleur /produits : lit la requête, appelle produitService et répond. */
export const produitController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    const filtres = {
      categorie_id: lireFiltreObjectId(query, 'categorie_id'),
      activite: lireFiltreValeur(query, 'activite', ACTIVITES),
    };
    reponse.json(await produitService.lister(lireSession(reponse), filtres, pagination));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await produitService.consulter(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async proposerCode(requete: Request, reponse: Response) {
    const nom = typeof requete.query.nom === 'string' ? requete.query.nom.slice(0, 120) : undefined;
    reponse.json(await produitService.proposerCode(nom));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const produit = await produitService.creer(lireSession(reponse), {
      ...donnees,
      nom: obligatoire(donnees.nom, 'nom'),
      categorie_id: obligatoire(donnees.categorie_id, 'categorie_id'),
      unite_stock: obligatoire(donnees.unite_stock, 'unite_stock'),
      activites: obligatoire(donnees.activites, 'activites'),
    });
    reponse.status(201).json(produit);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await produitService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },
};
