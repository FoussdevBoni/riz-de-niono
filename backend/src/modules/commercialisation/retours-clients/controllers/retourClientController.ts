import { avecNomsProduits } from '../../../produits/services/nomsProduitsService.js';
import type { Request, Response } from 'express';

import { erreurs } from '../../../../http/erreurs/erreurApplication.js';
import { ACTIVITES } from '../../../utilisateurs/services/utilisateurService.js';
import { lireSession } from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import {
  estObjectId,
  lireChaine,
  lireCorps,
  lireDate,
  lireDecimal,
  lireFiltreObjectId,
  lireFiltreValeur,
  lireIdentifiant,
  lireListe,
  lireMotif,
  lireObjectId,
  lireQuantite,
  obligatoire,
  type Donnees,
} from '../../../../http/validation/validationRequete.js';
import { retourClientService, type DonneesRetourClient, type LigneRetourSaisie } from '../services/retourClientService.js';

function lireLignes(donnees: Donnees): LigneRetourSaisie[] | undefined {
  const liste = lireListe(donnees, 'lignes');
  if (liste === undefined) return undefined;
  return liste.map((element, index) => {
    const ligne = (element ?? {}) as Donnees;
    const champ = (nom: string) => `lignes[${index}].${nom}`;
    if (!estObjectId(ligne.ligne_vente_id)) {
      throw erreurs.donneesInvalides(`Ligne de vente invalide pour la ligne ${index}.`, { champ: champ('ligne_vente_id') });
    }
    return {
      ligne_vente_id: ligne.ligne_vente_id.toLowerCase(),
      quantite: obligatoire(lireQuantite(ligne, 'quantite'), champ('quantite')),
      quantite_revendable: obligatoire(lireDecimal(ligne, 'quantite_revendable'), champ('quantite_revendable')),
      motif: obligatoire(lireChaine(ligne, 'motif', { max: 300 }), champ('motif')),
    };
  });
}

function lireDonnees(corps: unknown): DonneesRetourClient {
  const donnees = lireCorps(corps);
  return { vente_id: lireObjectId(donnees, 'vente_id'), date_retour: lireDate(donnees, 'date_retour'), lignes: lireLignes(donnees) };
}

/** Contrôleur /retours-clients : lit la requête, appelle retourClientService et répond. */
export const retourClientController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    // vente_id et activite se combinent quand les deux sont renseignés.
    const filtres = { vente_id: lireFiltreObjectId(query, 'vente_id'), activite: lireFiltreValeur(query, 'activite', ACTIVITES) };
    reponse.json(await avecNomsProduits(await retourClientService.lister(lireSession(reponse), filtres, pagination)));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await avecNomsProduits(await retourClientService.consulter(lireSession(reponse), lireIdentifiant(requete.params.id))));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const retour = await retourClientService.creer(lireSession(reponse), {
      vente_id: obligatoire(donnees.vente_id, 'vente_id'),
      date_retour: obligatoire(donnees.date_retour, 'date_retour'),
      lignes: obligatoire(donnees.lignes, 'lignes'),
    });
    reponse.status(201).json(retour);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await retourClientService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },

  async valider(requete: Request, reponse: Response) {
    reponse.json(await retourClientService.valider(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async annuler(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await retourClientService.annuler(lireSession(reponse), id, lireMotif(requete.body)));
  },
};
