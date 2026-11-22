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
  lireEffacable,
  lireFiltreObjectId,
  lireFiltreValeur,
  lireIdentifiant,
  lireListe,
  lireMotif,
  lireObjectId,
  lireQuantite,
  obligatoire,
  type Donnees,
} from '../../../http/validation/validationRequete.js';
import { ACTIVITES } from '../../utilisateurs/services/utilisateurService.js';
import {
  achatService,
  STATUTS_OPERATION,
  STATUTS_RECEPTION,
  type DonneesAchat,
  type LigneAchatSaisie,
} from '../services/achatService.js';

function lireLignes(donnees: Donnees): LigneAchatSaisie[] | undefined {
  const liste = lireListe(donnees, 'lignes');
  if (liste === undefined) return undefined;
  return liste.map((element, index) => {
    const ligne = (element ?? {}) as Donnees;
    const champ = (nom: string) => `lignes[${index}].${nom}`;
    if (ligne.produit_id !== undefined && ligne.produit_id !== null && !estObjectId(ligne.produit_id)) {
      throw erreurs.donneesInvalides(`Produit invalide pour la ligne ${index}.`, { champ: champ('produit_id') });
    }
    return {
      libelle: obligatoire(lireChaine(ligne, 'libelle', { max: 200 }), champ('libelle')),
      produit_id: typeof ligne.produit_id === 'string' ? ligne.produit_id.toLowerCase() : null,
      quantite: obligatoire(lireQuantite(ligne, 'quantite'), champ('quantite')),
      prix_unitaire: obligatoire(lireDecimal(ligne, 'prix_unitaire'), champ('prix_unitaire')),
    };
  });
}

function lireDonnees(corps: unknown): DonneesAchat {
  const donnees = lireCorps(corps);
  const activite = lireChaine(donnees, 'activite', { max: 30 });
  if (activite !== undefined && !ACTIVITES.includes(activite as (typeof ACTIVITES)[number])) {
    throw erreurs.donneesInvalides(`Valeurs autorisées pour activite : ${ACTIVITES.join(', ')}.`, { champ: 'activite' });
  }
  return {
    activite: activite as DonneesAchat['activite'],
    fournisseur_id: lireObjectId(donnees, 'fournisseur_id'),
    date_achat: lireDate(donnees, 'date_achat'),
    site_id: lireEffacable(donnees, 'site_id', lireObjectId),
    campagne_id: lireEffacable(donnees, 'campagne_id', lireObjectId),
    unite_transformation_id: lireEffacable(donnees, 'unite_transformation_id', lireObjectId),
    lignes: lireLignes(donnees),
  };
}

/** Contrôleur /achats : lit la requête, appelle achatService et répond. */
export const achatController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    const filtres = {
      activite: lireFiltreValeur(query, 'activite', ACTIVITES),
      fournisseur_id: lireFiltreObjectId(query, 'fournisseur_id'),
      statut: lireFiltreValeur(query, 'statut', STATUTS_OPERATION),
      statut_reception: lireFiltreValeur(query, 'statut_reception', STATUTS_RECEPTION),
    };
    reponse.json(await avecNomsProduits(await achatService.lister(lireSession(reponse), filtres, pagination)));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await avecNomsProduits(await achatService.consulter(lireSession(reponse), lireIdentifiant(requete.params.id))));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const achat = await achatService.creer(lireSession(reponse), {
      ...donnees,
      activite: obligatoire(donnees.activite, 'activite'),
      fournisseur_id: obligatoire(donnees.fournisseur_id, 'fournisseur_id'),
      date_achat: obligatoire(donnees.date_achat, 'date_achat'),
      lignes: obligatoire(donnees.lignes, 'lignes'),
    });
    reponse.status(201).json(achat);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await achatService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },

  async valider(requete: Request, reponse: Response) {
    reponse.json(await achatService.valider(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async receptionner(requete: Request, reponse: Response) {
    reponse.json(await achatService.receptionner(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async annuler(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await achatService.annuler(lireSession(reponse), id, lireMotif(requete.body)));
  },
};
