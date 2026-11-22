import type { Request, Response } from 'express';

import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { lireSession } from '../../../http/middlewares/verificationSessionMiddleware.js';
import { lireParametresPagination } from '../../../http/pagination/paginationUtils.js';
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
} from '../../../http/validation/validationRequete.js';
import {
  MODES_PAIEMENT,
  reglementFournisseurService,
  type DonneesReglementFournisseur,
  type ModePaiement,
} from '../services/reglementFournisseurService.js';
import { ACTIVITES } from '../../utilisateurs/services/utilisateurService.js';

function lireDonnees(corps: unknown): DonneesReglementFournisseur {
  const donnees = lireCorps(corps);
  const mode = lireChaine(donnees, 'mode', { max: 30 });
  if (mode !== undefined && !MODES_PAIEMENT.includes(mode as ModePaiement)) {
    throw erreurs.donneesInvalides(`Valeurs autorisées pour mode : ${MODES_PAIEMENT.join(', ')}.`, { champ: 'mode' });
  }
  return {
    achat_id: lireObjectId(donnees, 'achat_id'),
    date_paiement: lireDate(donnees, 'date_paiement'),
    montant: lireQuantite(donnees, 'montant'),
    mode: mode as ModePaiement | undefined,
    reference: lireEffacable(donnees, 'reference', (d, champ) => lireChaine(d, champ, { max: 100 })),
  };
}

/** Contrôleur /reglements-fournisseurs : lit la requête, appelle reglementFournisseurService et répond. */
export const reglementFournisseurController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    reponse.json(
      await reglementFournisseurService.lister(
        lireSession(reponse),
        { achat_id: lireFiltreObjectId(query, 'achat_id'), activite: lireFiltreValeur(query, 'activite', ACTIVITES) },
        pagination,
      ),
    );
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await reglementFournisseurService.consulter(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const reglement = await reglementFournisseurService.creer(lireSession(reponse), {
      ...donnees,
      achat_id: obligatoire(donnees.achat_id, 'achat_id'),
      date_paiement: obligatoire(donnees.date_paiement, 'date_paiement'),
      montant: obligatoire(donnees.montant, 'montant'),
      mode: obligatoire(donnees.mode, 'mode'),
    });
    reponse.status(201).json(reglement);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await reglementFournisseurService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },

  async valider(requete: Request, reponse: Response) {
    reponse.json(await reglementFournisseurService.valider(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async annuler(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await reglementFournisseurService.annuler(lireSession(reponse), id, lireMotif(requete.body)));
  },
};
