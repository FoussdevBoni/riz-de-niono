import type { NextFunction, Request, Response } from 'express';

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
import { ACTIVITES, type Activite } from '../../utilisateurs/services/utilisateurService.js';
import { depenseService, type DonneesDepense } from '../services/depenseService.js';

function lireDonnees(corps: unknown): DonneesDepense {
  const donnees = lireCorps(corps);
  const activite = lireChaine(donnees, 'activite', { max: 30 });
  if (activite !== undefined && !ACTIVITES.includes(activite as Activite)) {
    throw erreurs.donneesInvalides(`Valeurs autorisées pour activite : ${ACTIVITES.join(', ')}.`, { champ: 'activite' });
  }
  return {
    activite: activite as Activite | undefined,
    type_depense_id: lireObjectId(donnees, 'type_depense_id'),
    date_depense: lireDate(donnees, 'date_depense'),
    montant: lireQuantite(donnees, 'montant'),
    libelle: lireChaine(donnees, 'libelle', { max: 200 }),
    site_id: lireEffacable(donnees, 'site_id', lireObjectId),
    campagne_id: lireEffacable(donnees, 'campagne_id', lireObjectId),
    unite_transformation_id: lireEffacable(donnees, 'unite_transformation_id', lireObjectId),
    materiel_id: lireEffacable(donnees, 'materiel_id', lireObjectId),
  };
}

/** Contrôleur /depenses : lit la requête, appelle depenseService et répond. */
export const depenseController = {
  async lister(requete: Request, reponse: Response) {
    const query = requete.query as Donnees;
    const pagination = lireParametresPagination(query);
    const filtres = {
      activite: lireFiltreValeur(query, 'activite', ACTIVITES),
      site_id: lireFiltreObjectId(query, 'site_id'),
      campagne_id: lireFiltreObjectId(query, 'campagne_id'),
      type_depense_id: lireFiltreObjectId(query, 'type_depense_id'),
    };
    reponse.json(await depenseService.lister(lireSession(reponse), filtres, pagination));
  },

  async consulter(requete: Request, reponse: Response) {
    reponse.json(await depenseService.consulter(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async creer(requete: Request, reponse: Response) {
    const donnees = lireDonnees(requete.body);
    const depense = await depenseService.creer(lireSession(reponse), {
      ...donnees,
      activite: obligatoire(donnees.activite, 'activite'),
      type_depense_id: obligatoire(donnees.type_depense_id, 'type_depense_id'),
      date_depense: obligatoire(donnees.date_depense, 'date_depense'),
      montant: obligatoire(donnees.montant, 'montant'),
      libelle: obligatoire(donnees.libelle, 'libelle'),
    });
    reponse.status(201).json(depense);
  },

  async modifier(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await depenseService.modifier(lireSession(reponse), id, lireDonnees(requete.body)));
  },

  async valider(requete: Request, reponse: Response) {
    reponse.json(await depenseService.valider(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },

  async annuler(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    reponse.json(await depenseService.annuler(lireSession(reponse), id, lireMotif(requete.body)));
  },

  /** Contrôle des droits et du statut avant la lecture du fichier. */
  async verifierAvantJustificatif(requete: Request, reponse: Response, suivant: NextFunction) {
    await depenseService.verifierJustificatifModifiable(lireSession(reponse), lireIdentifiant(requete.params.id));
    suivant();
  },

  /**
   * Corps : octets du fichier. Content-Type : type déclaré (contrôlé contre le contenu réel).
   * En-tête facultatif X-Nom-Fichier : nom d'origine, encodé en URI.
   */
  async joindreJustificatif(requete: Request, reponse: Response) {
    const id = lireIdentifiant(requete.params.id);
    const contenu = Buffer.isBuffer(requete.body) ? requete.body : Buffer.alloc(0);
    const typeMime = (requete.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
    if (!typeMime) {
      throw erreurs.donneesInvalides('Indiquer le type du fichier dans l’en-tête Content-Type.', { champ: 'fichier' });
    }
    reponse.json(
      await depenseService.joindreJustificatif(lireSession(reponse), id, {
        contenu,
        type_mime: typeMime,
        nom_original: lireNomFichier(requete.headers['x-nom-fichier']),
      }),
    );
  },

  async retirerJustificatif(requete: Request, reponse: Response) {
    reponse.json(await depenseService.retirerJustificatif(lireSession(reponse), lireIdentifiant(requete.params.id)));
  },
};

function lireNomFichier(entete: string | string[] | undefined): string | undefined {
  const valeur = Array.isArray(entete) ? entete[0] : entete;
  if (!valeur) return undefined;
  try {
    return decodeURIComponent(valeur).slice(0, 200);
  } catch {
    return valeur.slice(0, 200);
  }
}
