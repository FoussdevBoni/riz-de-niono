import { avecNomsProduits } from '../../produits/services/nomsProduitsService.js';
import type { Request, Response } from 'express';

import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { lireSession } from '../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../http/pagination/paginationUtils.js';
import {
  estObjectId,
  lireChaine,
  lireCorps,
  lireDate,
  lireDecimal,
  lireFiltreValeur,
  lireIdentifiant,
  lireListe,
  lireMotif,
  obligatoire,
  type Donnees,
} from '../../../http/validation/validationRequete.js';
import { inventaireService, STATUTS_OPERATION, type LigneComptee } from '../services/inventaireService.js';

function lireLignes(donnees: Donnees): LigneComptee[] | undefined {
  const liste = lireListe(donnees, 'lignes');
  if (liste === undefined) return undefined;
  return liste.map((element, index) => {
    const ligne = (element ?? {}) as Donnees;
    if (!estObjectId(ligne.produit_id)) {
      throw erreurs.donneesInvalides(`Produit invalide pour la ligne ${index}.`, { champ: `lignes[${index}].produit_id` });
    }
    return {
      produit_id: ligne.produit_id.toLowerCase(),
      // Un comptage peut être nul : « 0 » est admis.
      quantite_comptee: obligatoire(lireDecimal(ligne, 'quantite_comptee'), `lignes[${index}].quantite_comptee`),
      motif_ecart: lireChaine(ligne, 'motif_ecart', { max: 300 }) ?? null,
    };
  });
}

function lireDonnees(corps: unknown) {
  const donnees = lireCorps(corps);
  return { date_inventaire: lireDate(donnees, 'date_inventaire'), lignes: lireLignes(donnees) };
}

/** Contrôleur /inventaires : lit la requête, appelle inventaireService et répond. */
export const inventaireController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    reponse.json(await avecNomsProduits(await inventaireService.lister({ statut: lireFiltreValeur(query, 'statut', STATUTS_OPERATION) }, pagination)));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await avecNomsProduits(await inventaireService.consulter(lireIdentifiant(requete.params.id))));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const inventaire = await inventaireService.creer(lireSession(reponse), {
      date_inventaire: obligatoire(donnees.date_inventaire, 'date_inventaire'),
      lignes: obligatoire(donnees.lignes, 'lignes'),
    });
    reponse.status(201).json(inventaire);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await inventaireService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },

  async valider(requete: Request, reponse: Response) {
    reponse.json(await inventaireService.valider(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async annuler(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await inventaireService.annuler(lireSession(reponse), id, lireMotif(requete.body)));
  },
};
