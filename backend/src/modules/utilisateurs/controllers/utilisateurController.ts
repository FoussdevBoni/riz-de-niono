import type { Request, Response } from 'express';

import { lireSession } from '../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../http/pagination/paginationUtils.js';
import {
  lireBooleen,
  lireChaine,
  lireCorps,
  lireEmail,
  lireFiltreObjectId,
  lireFiltreValeur,
  lireIdentifiant,
  lireListeObjectIds,
  lireListeValeurs,
  lireMotDePasse,
  lireObjectId,
  obligatoire,
  type Donnees,
} from '../../../http/validation/validationRequete.js';
import { ACTIVITES, utilisateurService, type DonneesUtilisateur } from '../services/utilisateurService.js';

function lireDonneesUtilisateur(corps: unknown): DonneesUtilisateur {
  const donnees = lireCorps(corps);
  return {
    nom: lireChaine(donnees, 'nom', { max: 100 }),
    email: lireEmail(donnees),
    mot_de_passe: lireMotDePasse(donnees, 'mot_de_passe'),
    role_id: lireObjectId(donnees, 'role_id'),
    activites: lireListeValeurs(donnees, 'activites', ACTIVITES),
    site_ids: lireListeObjectIds(donnees, 'site_ids'),
    actif: lireBooleen(donnees, 'actif'),
  };
}

/** Contrôleur /utilisateurs : lit la requête, appelle utilisateurService et produit la réponse HTTP. */
export const utilisateurController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    const filtres = {
      role_id: lireFiltreObjectId(query, 'role_id'),
      activite: lireFiltreValeur(query, 'activite', ACTIVITES),
    };
    reponse.json(await utilisateurService.lister(lireSession(reponse), filtres, pagination));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await utilisateurService.consulter(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonneesUtilisateur(requete.body);
    const utilisateur = await utilisateurService.creer(lireSession(reponse), {
      ...donnees,
      nom: obligatoire(donnees.nom, 'nom'),
      email: obligatoire(donnees.email, 'email'),
      mot_de_passe: obligatoire(donnees.mot_de_passe, 'mot_de_passe'),
      role_id: obligatoire(donnees.role_id, 'role_id'),
    });
    reponse.status(201).json(utilisateur);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await utilisateurService.modifier(lireSession(reponse), id, lireDonneesUtilisateur(requete.body)));
  },
};
