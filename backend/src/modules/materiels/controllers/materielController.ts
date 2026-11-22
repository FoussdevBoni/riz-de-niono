import type { Request, Response } from 'express';

import { lireSession } from '../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../http/pagination/paginationUtils.js';
import {
  lireBooleen,
  lireChaine,
  lireCode,
  lireCorps,
  lireDecimal,
  lireFiltreValeur,
  lireIdentifiant,
  lireListeValeurs,
  obligatoire,
  type Donnees,
} from '../../../http/validation/validationRequete.js';
import { ACTIVITES } from '../../utilisateurs/services/utilisateurService.js';
import { materielService, type DonneesMateriel } from '../services/materielService.js';

function lireDonnees(corps: unknown): DonneesMateriel {
  const donnees = lireCorps(corps);
  return {
    code: lireCode(donnees),
    nom: lireChaine(donnees, 'nom', { max: 100 }),
    activites: lireListeValeurs(donnees, 'activites', ACTIVITES),
    quantite_totale: lireDecimal(donnees, 'quantite_totale'),
    quantite_disponible: lireDecimal(donnees, 'quantite_disponible'),
    actif: lireBooleen(donnees, 'actif'),
  };
}

/** Contrôleur /materiels : lit la requête, appelle materielService et répond. */
export const materielController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    reponse.json(await materielService.lister(lireSession(reponse), { activite: lireFiltreValeur(query, 'activite', ACTIVITES) }, pagination));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await materielService.consulter(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async proposerCode(requete: Request, reponse: Response) {
    const nom = typeof requete.query.nom === 'string' ? requete.query.nom.slice(0, 120) : undefined;
    reponse.json(await materielService.proposerCode(nom));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const materiel = await materielService.creer(lireSession(reponse), {
      code: donnees.code,
      nom: obligatoire(donnees.nom, 'nom'),
      activites: obligatoire(donnees.activites, 'activites'),
      quantite_totale: obligatoire(donnees.quantite_totale, 'quantite_totale'),
      quantite_disponible: obligatoire(donnees.quantite_disponible, 'quantite_disponible'),
    });
    reponse.status(201).json(materiel);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await materielService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },
};
