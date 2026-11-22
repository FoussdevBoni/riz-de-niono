import type { Request, Response } from 'express';

import { erreurs } from '../../../../http/erreurs/erreurApplication.js';
import { ACTIVITES } from '../../../utilisateurs/services/utilisateurService.js';
import { lireSession } from '../../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import {
  lireChaine,
  lireCorps,
  lireDate,
  lireEffacable,
  lireFiltreObjectId,
  lireFiltreValeur,
  lireIdentifiant,
  lireMotif,
  lireObjectId,
  lireQuantite,
  obligatoire,
  type Donnees,
} from '../../../../http/validation/validationRequete.js';
import {
  encaissementService,
  MODES_ENCAISSEMENT,
  type DonneesEncaissement,
  type ModeEncaissement,
} from '../services/encaissementService.js';

function lireDonnees(corps: unknown): DonneesEncaissement {
  const donnees = lireCorps(corps);
  const mode = lireChaine(donnees, 'mode', { max: 30 });
  if (mode !== undefined && !MODES_ENCAISSEMENT.includes(mode as ModeEncaissement)) {
    throw erreurs.donneesInvalides(`Valeurs autorisées pour mode : ${MODES_ENCAISSEMENT.join(', ')}.`, { champ: 'mode' });
  }
  return {
    vente_id: lireObjectId(donnees, 'vente_id'),
    date_paiement: lireDate(donnees, 'date_paiement'),
    montant: lireQuantite(donnees, 'montant'),
    mode: mode as ModeEncaissement | undefined,
    reference: lireEffacable(donnees, 'reference', (d, champ) => lireChaine(d, champ, { max: 100 })),
  };
}

/** Contrôleur /encaissements : lit la requête, appelle encaissementService et répond. */
export const encaissementController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    // vente_id et activite se combinent quand les deux sont renseignés.
    const filtres = { vente_id: lireFiltreObjectId(query, 'vente_id'), activite: lireFiltreValeur(query, 'activite', ACTIVITES) };
    reponse.json(await encaissementService.lister(lireSession(reponse), filtres, pagination));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await encaissementService.consulter(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const encaissement = await encaissementService.creer(lireSession(reponse), {
      ...donnees,
      vente_id: obligatoire(donnees.vente_id, 'vente_id'),
      date_paiement: obligatoire(donnees.date_paiement, 'date_paiement'),
      montant: obligatoire(donnees.montant, 'montant'),
      mode: obligatoire(donnees.mode, 'mode'),
    });
    reponse.status(201).json(encaissement);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await encaissementService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },

  async valider(requete: Request, reponse: Response) {
    reponse.json(await encaissementService.valider(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async annuler(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await encaissementService.annuler(lireSession(reponse), id, lireMotif(requete.body)));
  },
};
