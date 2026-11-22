import { Types, type ClientSession } from 'mongoose';

import { estErreurDoublon } from '../../../database/erreursMongo.js';
import { executerTransaction } from '../../../database/transactionMongo.js';
import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../http/pagination/paginationUtils.js';
import {
  authentificationService,
  type ContexteSession,
} from '../../authentification/services/authentificationService.js';
import { journalOperationService, type ActionJournal } from '../../journal-operations/services/journalOperationService.js';
import { siteProductionService } from '../../production/sites-production/services/siteProductionService.js';
import { roleService, type Permission } from '../../roles/services/roleService.js';
import { UtilisateurModel, type DocumentUtilisateur } from '../models/utilisateurModel.js';
import { ACTIVITES, type Activite } from '../schemas/utilisateurSchema.js';

export { ACTIVITES, type Activite };

export interface UtilisateurPublic {
  _id: string;
  nom: string;
  email: string;
  actif: boolean;
  role_id: string;
  activites: Activite[];
  site_ids: string[];
  created_at: Date;
  updated_at: Date;
}

/** Profil de la session : fiche de l'utilisateur, rôle et permissions effectives. */
export interface Profil {
  _id: string;
  nom: string;
  email: string;
  actif: boolean;
  role: { _id: string; code: string; nom: string } | null;
  activites: Activite[];
  site_ids: string[];
  permissions: Permission[];
}

export interface DonneesUtilisateur {
  nom?: string;
  email?: string;
  mot_de_passe?: string;
  role_id?: string;
  activites?: Activite[];
  site_ids?: string[];
  actif?: boolean;
}

interface Perimetre {
  activites: readonly string[];
  site_ids: readonly string[];
}

function formater(utilisateur: DocumentUtilisateur): UtilisateurPublic {
  return {
    _id: String(utilisateur._id),
    nom: utilisateur.nom,
    email: utilisateur.email,
    actif: utilisateur.actif,
    role_id: String(utilisateur.role_id),
    activites: [...utilisateur.activites],
    site_ids: utilisateur.site_ids.map(String),
    created_at: utilisateur.created_at,
    updated_at: utilisateur.updated_at,
  };
}

/**
 * Règle de périmètre : un gestionnaire ne voit et n'attribue que ce qu'il couvre lui-même.
 * Ses activités doivent inclure celles de la cible. S'il est limité à des sites,
 * la cible doit être limitée à des sites qu'il couvre (une liste vide signifie tous les sites).
 */
function couvre(gestionnaire: Perimetre, cible: Perimetre): boolean {
  if (!cible.activites.every((activite) => gestionnaire.activites.includes(activite))) return false;
  if (gestionnaire.site_ids.length === 0) return true;
  return cible.site_ids.length > 0 && cible.site_ids.every((site) => gestionnaire.site_ids.includes(site));
}

/** Traduction de couvre() en filtre MongoDB pour les listes. */
function filtrePerimetre(contexte: ContexteSession): Record<string, unknown> {
  const filtre: Record<string, unknown> = {
    activites: { $not: { $elemMatch: { $nin: contexte.activites } } },
  };
  if (contexte.site_ids.length > 0) {
    filtre.site_ids = {
      $ne: [],
      $not: { $elemMatch: { $nin: contexte.site_ids.map((id) => new Types.ObjectId(id)) } },
    };
  }
  return filtre;
}

function perimetreDe(utilisateur: DocumentUtilisateur): Perimetre {
  return { activites: utilisateur.activites, site_ids: utilisateur.site_ids.map(String) };
}

/** Vérifie la cohérence et le périmètre d'une affectation (activités et sites). */
function verifierAffectation(contexte: ContexteSession, cible: Perimetre): void {
  if (cible.site_ids.length > 0 && !cible.activites.includes('production')) {
    throw erreurs.donneesInvalides('Des sites ne peuvent être attribués qu’avec l’activité production.', {
      champ: 'site_ids',
    });
  }
  if (!couvre(contexte, cible)) {
    throw erreurs.accesRefuse('Les activités ou sites attribués dépassent votre propre périmètre.');
  }
}

/** Utilisateur visible dans le périmètre de la session ; sinon 404 pour ne pas révéler son existence. */
async function trouverDansPerimetre(contexte: ContexteSession, id: string): Promise<DocumentUtilisateur> {
  const utilisateur = await UtilisateurModel.findById(id).lean<DocumentUtilisateur>();
  if (!utilisateur || !couvre(contexte, perimetreDe(utilisateur))) {
    throw erreurs.ressourceIntrouvable('Utilisateur introuvable.');
  }
  return utilisateur;
}

async function verifierEmailLibre(email: string, saufId?: string): Promise<void> {
  const filtre = saufId ? { email, _id: { $ne: saufId } } : { email };
  if (await UtilisateurModel.exists(filtre)) throw erreurEmailDejaUtilise();
}

function erreurEmailDejaUtilise() {
  return erreurs.conflit('email_deja_utilise', 'Cette adresse est déjà utilisée par un autre compte.', {
    champ: 'email',
  });
}

function memesValeurs(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((valeur) => b.includes(valeur));
}

/**
 * Service du module utilisateurs (comptes et profil de la session).
 * Applique le périmètre par activité et site, hache les mots de passe via le service
 * Authentification et journalise les créations et changements de droits.
 */
export const utilisateurService = {
  async lister(
    contexte: ContexteSession,
    filtres: { role_id?: string; activite?: Activite },
    pagination: ParametresPagination,
  ): Promise<PageResultats<UtilisateurPublic>> {
    const conditions: Record<string, unknown>[] = [filtrePerimetre(contexte)];
    if (filtres.role_id) conditions.push({ role_id: filtres.role_id });
    if (filtres.activite) conditions.push({ activites: filtres.activite });
    const filtre = { $and: conditions };

    const [utilisateurs, total] = await Promise.all([
      UtilisateurModel.find(filtre)
        .sort({ nom: 1 })
        .skip(pagination.saut)
        .limit(pagination.taille_page)
        .lean<DocumentUtilisateur[]>(),
      UtilisateurModel.countDocuments(filtre),
    ]);
    return construirePage(utilisateurs.map(formater), total, pagination);
  },

  async consulter(contexte: ContexteSession, id: string): Promise<UtilisateurPublic> {
    return formater(await trouverDansPerimetre(contexte, id));
  },

  async creer(
    contexte: ContexteSession,
    donnees: Required<Pick<DonneesUtilisateur, 'nom' | 'email' | 'mot_de_passe' | 'role_id'>> & DonneesUtilisateur,
  ): Promise<UtilisateurPublic> {
    const affectation = { activites: donnees.activites ?? [], site_ids: donnees.site_ids ?? [] };
    authentificationService.verifierRobustesse(donnees.mot_de_passe, 'mot_de_passe');
    verifierAffectation(contexte, affectation);
    await siteProductionService.verifierSitesAttribuables(affectation.site_ids);
    await roleService.verifierRoleAttribuable(donnees.role_id);
    await verifierEmailLibre(donnees.email);
    const mot_de_passe_hash = await authentificationService.hacherMotDePasse(donnees.mot_de_passe);

    try {
      const id = await executerTransaction(async (session) => {
        const [utilisateur] = await UtilisateurModel.create(
          [
            {
              nom: donnees.nom,
              email: donnees.email,
              mot_de_passe_hash,
              actif: donnees.actif ?? true,
              role_id: donnees.role_id,
              ...affectation,
            },
          ],
          { session },
        );
        await journalOperationService.enregistrer(
          {
            utilisateur_id: contexte.utilisateur_id,
            action: 'creation',
            collection: 'utilisateurs',
            document_id: String(utilisateur._id),
          },
          session,
        );
        return String(utilisateur._id);
      });
      return utilisateurService.consulter(contexte, id);
    } catch (erreur) {
      if (estErreurDoublon(erreur)) throw erreurEmailDejaUtilise();
      throw erreur;
    }
  },

  async modifier(contexte: ContexteSession, id: string, donnees: DonneesUtilisateur): Promise<UtilisateurPublic> {
    const utilisateur = await trouverDansPerimetre(contexte, id);
    const actuel = perimetreDe(utilisateur);
    const affectation = {
      activites: donnees.activites ?? actuel.activites,
      site_ids: donnees.site_ids ?? actuel.site_ids,
    };
    const changeRole = donnees.role_id !== undefined && donnees.role_id !== String(utilisateur.role_id);
    const changePerimetre =
      !memesValeurs(affectation.activites, actuel.activites) || !memesValeurs(affectation.site_ids, actuel.site_ids);
    const changeActif = donnees.actif !== undefined && donnees.actif !== utilisateur.actif;

    // Un compte ne modifie pas ses propres droits : cela évite de se bloquer ou de s'en attribuer.
    if (id === contexte.utilisateur_id && (changeRole || changePerimetre || changeActif)) {
      throw erreurs.conflit(
        'modification_propre_compte',
        'Vous ne pouvez pas modifier votre propre rôle, périmètre ou activation.',
      );
    }

    verifierAffectation(contexte, affectation);
    if (!memesValeurs(affectation.site_ids, actuel.site_ids)) {
      await siteProductionService.verifierSitesAttribuables(affectation.site_ids);
    }
    if (changeRole) await roleService.verifierRoleAttribuable(donnees.role_id!);
    if (donnees.email !== undefined && donnees.email !== utilisateur.email) await verifierEmailLibre(donnees.email, id);

    const modifications: Record<string, unknown> = {};
    if (donnees.nom !== undefined) modifications.nom = donnees.nom;
    if (donnees.email !== undefined) modifications.email = donnees.email;
    if (changeRole) modifications.role_id = donnees.role_id;
    if (changePerimetre) Object.assign(modifications, affectation);
    if (changeActif) modifications.actif = donnees.actif;
    if (donnees.mot_de_passe !== undefined) {
      authentificationService.verifierRobustesse(donnees.mot_de_passe, 'mot_de_passe');
      modifications.mot_de_passe_hash = await authentificationService.hacherMotDePasse(donnees.mot_de_passe);
    }
    if (Object.keys(modifications).length === 0) return formater(utilisateur);

    let action: ActionJournal = 'modification';
    if (changeActif) action = donnees.actif ? 'reactivation' : 'archivage';
    else if (changeRole || changePerimetre) action = 'changement_droits';

    try {
      await executerTransaction(async (session) => {
        await UtilisateurModel.updateOne({ _id: id }, { $set: modifications }, { session });
        // Un compte désactivé ou dont le mot de passe est redéfini perd ses sessions ouvertes.
        if (donnees.actif === false || donnees.mot_de_passe !== undefined) {
          await authentificationService.revoquerSessionsUtilisateur(id, session);
        }
        await journalOperationService.enregistrer(
          { utilisateur_id: contexte.utilisateur_id, action, collection: 'utilisateurs', document_id: id },
          session,
        );
      });
    } catch (erreur) {
      if (estErreurDoublon(erreur)) throw erreurEmailDejaUtilise();
      throw erreur;
    }
    return utilisateurService.consulter(contexte, id);
  },

  /* Profil de la session (/api/v1/profil). */

  async lireProfil(utilisateurId: string): Promise<Profil> {
    const utilisateur = await UtilisateurModel.findById(utilisateurId).lean<DocumentUtilisateur>();
    if (!utilisateur) throw erreurs.sessionInvalide();
    const droits = await roleService.lireDroits(String(utilisateur.role_id));
    return {
      _id: String(utilisateur._id),
      nom: utilisateur.nom,
      email: utilisateur.email,
      actif: utilisateur.actif,
      role: droits && { _id: droits._id, code: droits.code, nom: droits.nom },
      activites: [...utilisateur.activites],
      site_ids: utilisateur.site_ids.map(String),
      permissions: droits?.permissions ?? [],
    };
  },

  async modifierProfil(contexte: ContexteSession, donnees: { nom?: string }): Promise<Profil> {
    const utilisateurId = contexte.utilisateur_id!;
    if (donnees.nom !== undefined) {
      await executerTransaction(async (session) => {
        await UtilisateurModel.updateOne({ _id: utilisateurId }, { $set: { nom: donnees.nom } }, { session });
        await journalOperationService.enregistrer(
          { utilisateur_id: utilisateurId, action: 'modification', collection: 'utilisateurs', document_id: utilisateurId },
          session,
        );
      });
    }
    return utilisateurService.lireProfil(utilisateurId);
  },

  /** Changement par l'utilisateur lui-même : ses autres sessions sont révoquées, la courante est conservée. */
  async changerMotDePasse(contexte: ContexteSession, actuel: string, nouveau: string): Promise<void> {
    const utilisateurId = contexte.utilisateur_id!;
    const utilisateur = await UtilisateurModel.findById(utilisateurId).lean<DocumentUtilisateur>();
    if (!utilisateur) throw erreurs.sessionInvalide();
    if (!(await authentificationService.verifierMotDePasse(actuel, utilisateur.mot_de_passe_hash))) {
      throw erreurs.donneesInvalides(
        'Le mot de passe actuel est incorrect.',
        { champ: 'mot_de_passe_actuel' },
        'mot_de_passe_incorrect',
      );
    }
    authentificationService.verifierRobustesse(nouveau, 'nouveau_mot_de_passe');
    const mot_de_passe_hash = await authentificationService.hacherMotDePasse(nouveau);

    await executerTransaction(async (session) => {
      await UtilisateurModel.updateOne({ _id: utilisateurId }, { $set: { mot_de_passe_hash } }, { session });
      await authentificationService.revoquerSessionsUtilisateur(utilisateurId, session, contexte.session_id);
      await journalOperationService.enregistrer(
        { utilisateur_id: utilisateurId, action: 'modification', collection: 'utilisateurs', document_id: utilisateurId },
        session,
      );
    });
  },

  /* Opérations internes appelées par le service Authentification et le service Rôles. */

  async trouverPourAuthentification(
    email: string,
  ): Promise<{ _id: string; mot_de_passe_hash: string; actif: boolean } | null> {
    const utilisateur = await UtilisateurModel.findOne({ email: email.trim().toLowerCase() }).lean<DocumentUtilisateur>();
    return utilisateur
      ? { _id: String(utilisateur._id), mot_de_passe_hash: utilisateur.mot_de_passe_hash, actif: utilisateur.actif }
      : null;
  },

  async lirePerimetre(
    utilisateurId: string,
  ): Promise<{ actif: boolean; role_id: string; activites: Activite[]; site_ids: string[] } | null> {
    const utilisateur = await UtilisateurModel.findById(utilisateurId).lean<DocumentUtilisateur>();
    return utilisateur
      ? {
          actif: utilisateur.actif,
          role_id: String(utilisateur.role_id),
          activites: [...utilisateur.activites],
          site_ids: utilisateur.site_ids.map(String),
        }
      : null;
  },

  /** Nouveau mot de passe défini par réinitialisation, dans la transaction du service Authentification. */
  async definirMotDePasse(utilisateurId: string, motDePasseHash: string, session: ClientSession): Promise<void> {
    await UtilisateurModel.updateOne({ _id: utilisateurId }, { $set: { mot_de_passe_hash: motDePasseHash } }, { session });
    await journalOperationService.enregistrer(
      {
        utilisateur_id: utilisateurId,
        action: 'reinitialisation_mot_de_passe',
        collection: 'utilisateurs',
        document_id: utilisateurId,
      },
      session,
    );
  },

  /** Vérifie qu'un utilisateur référencé (ex. responsable de site) existe et est actif. */
  async verifierUtilisateurActif(utilisateurId: string, champ: string): Promise<void> {
    if (!(await UtilisateurModel.exists({ _id: utilisateurId, actif: true }))) {
      throw erreurs.donneesInvalides('L’utilisateur indiqué est introuvable ou désactivé.', { champ });
    }
  },

  /** Nom de chaque utilisateur demandé (auteurs du journal). */
  async lireNoms(ids: readonly string[]): Promise<Map<string, string>> {
    const utilisateurs = await UtilisateurModel.find({ _id: { $in: ids } }, { nom: 1 }).lean<Pick<DocumentUtilisateur, '_id' | 'nom'>[]>();
    return new Map(utilisateurs.map((utilisateur) => [String(utilisateur._id), utilisateur.nom]));
  },

  async compterActifsParRole(roleId: string): Promise<number> {
    return UtilisateurModel.countDocuments({ role_id: roleId, actif: true });
  },

  async trouverIdParEmail(email: string): Promise<string | null> {
    const utilisateur = await UtilisateurModel.findOne({ email: email.trim().toLowerCase() }, { _id: 1 }).lean<{
      _id: Types.ObjectId;
    }>();
    return utilisateur ? String(utilisateur._id) : null;
  },
};
