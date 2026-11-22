import { Types } from 'mongoose';

import { estErreurDoublon } from '../../../database/erreursMongo.js';
import { executerTransaction } from '../../../database/transactionMongo.js';
import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../http/pagination/paginationUtils.js';
import type { ContexteSession } from '../../authentification/services/authentificationService.js';
import { journalOperationService, type ActionJournal } from '../../journal-operations/services/journalOperationService.js';
import { utilisateurService } from '../../utilisateurs/services/utilisateurService.js';
import { RoleModel, type DocumentRole } from '../models/roleModel.js';
import {
  ACTIONS_PERMISSIONS,
  MODULES_PERMISSIONS,
  type CodeAction,
  type CodeModule,
  type Permission,
} from '../schemas/roleSchema.js';

export { ACTIONS_PERMISSIONS, MODULES_PERMISSIONS, type CodeAction, type CodeModule, type Permission };

const MOTIF_CODE_ROLE = /^[a-z0-9_]{2,50}$/;

export interface RolePublic {
  _id: string;
  code: string;
  nom: string;
  permissions: Permission[];
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesRole {
  code?: string;
  nom?: string;
  permissions?: Permission[];
  actif?: boolean;
}

function formater(role: DocumentRole): RolePublic {
  return {
    _id: String(role._id),
    code: role.code,
    nom: role.nom,
    permissions: role.permissions.map(({ module, action }) => ({ module, action })),
    actif: role.actif,
    created_at: role.created_at,
    updated_at: role.updated_at,
  };
}

function normaliserPermissions(permissions: Permission[]): Permission[] {
  const uniques = new Map(permissions.map((p) => [`${p.module}:${p.action}`, p]));
  return [...uniques.values()].sort((a, b) =>
    a.module === b.module ? a.action.localeCompare(b.action) : a.module.localeCompare(b.module),
  );
}

function verifierCode(code: string): void {
  if (!MOTIF_CODE_ROLE.test(code)) {
    throw erreurs.donneesInvalides(
      'Le code du rôle contient de 2 à 50 caractères : minuscules, chiffres ou « _ ».',
      { champ: 'code' },
    );
  }
}

async function trouver(id: string): Promise<DocumentRole> {
  const role = await RoleModel.findById(id).lean<DocumentRole>();
  if (!role) throw erreurs.ressourceIntrouvable('Rôle introuvable.');
  return role;
}

function erreurCodeDejaUtilise() {
  return erreurs.conflit('code_deja_utilise', 'Ce code de rôle est déjà utilisé.', { champ: 'code' });
}

/**
 * Service du module roles.
 * Gère les rôles et leurs permissions (module + action). Les rôles sont globaux :
 * le périmètre par activité ou site s'applique aux utilisateurs, pas aux rôles.
 */
export const roleService = {
  async lister(filtres: { actif?: boolean }, pagination: ParametresPagination): Promise<PageResultats<RolePublic>> {
    const filtre = filtres.actif === undefined ? {} : { actif: filtres.actif };
    const [roles, total] = await Promise.all([
      RoleModel.find(filtre).sort({ nom: 1 }).skip(pagination.saut).limit(pagination.taille_page).lean<DocumentRole[]>(),
      RoleModel.countDocuments(filtre),
    ]);
    return construirePage(roles.map(formater), total, pagination);
  },

  async consulter(id: string): Promise<RolePublic> {
    return formater(await trouver(id));
  },

  async creer(
    contexte: ContexteSession,
    donnees: Required<Pick<DonneesRole, 'code' | 'nom'>> & DonneesRole,
  ): Promise<RolePublic> {
    verifierCode(donnees.code);
    if (await RoleModel.exists({ code: donnees.code })) throw erreurCodeDejaUtilise();

    try {
      const id = await executerTransaction(async (session) => {
        const [role] = await RoleModel.create(
          [{ code: donnees.code, nom: donnees.nom, permissions: normaliserPermissions(donnees.permissions ?? []) }],
          { session },
        );
        await journalOperationService.enregistrer(
          { utilisateur_id: contexte.utilisateur_id, action: 'creation', collection: 'roles', document_id: String(role._id) },
          session,
        );
        return String(role._id);
      });
      return roleService.consulter(id);
    } catch (erreur) {
      if (estErreurDoublon(erreur)) throw erreurCodeDejaUtilise();
      throw erreur;
    }
  },

  async modifier(contexte: ContexteSession, id: string, donnees: DonneesRole): Promise<RolePublic> {
    const role = await trouver(id);
    const modifications: Partial<DocumentRole> = {};

    if (donnees.code !== undefined && donnees.code !== role.code) {
      verifierCode(donnees.code);
      if (await RoleModel.exists({ code: donnees.code })) throw erreurCodeDejaUtilise();
      modifications.code = donnees.code;
    }
    if (donnees.nom !== undefined) modifications.nom = donnees.nom;
    if (donnees.permissions !== undefined) modifications.permissions = normaliserPermissions(donnees.permissions);
    if (donnees.actif !== undefined) modifications.actif = donnees.actif;
    if (Object.keys(modifications).length === 0) return formater(role);

    // Archiver un rôle encore porté par des comptes actifs leur retirerait tous leurs droits.
    if (donnees.actif === false && role.actif) {
      const utilisateurs = await utilisateurService.compterActifsParRole(id);
      if (utilisateurs > 0) {
        throw erreurs.conflit('role_utilise', 'Ce rôle est attribué à des utilisateurs actifs.', { utilisateurs });
      }
    }

    let action: ActionJournal = 'modification';
    if (donnees.actif === false && role.actif) action = 'archivage';
    else if (donnees.actif === true && !role.actif) action = 'reactivation';
    else if (modifications.permissions) action = 'changement_droits';

    try {
      await executerTransaction(async (session) => {
        await RoleModel.updateOne({ _id: id }, { $set: modifications }, { session });
        await journalOperationService.enregistrer(
          { utilisateur_id: contexte.utilisateur_id, action, collection: 'roles', document_id: id },
          session,
        );
      });
    } catch (erreur) {
      if (estErreurDoublon(erreur)) throw erreurCodeDejaUtilise();
      throw erreur;
    }
    return roleService.consulter(id);
  },

  /* Opérations internes appelées par les autres modules. */

  /** Droits d'un rôle pour construire un contexte de session. Un rôle archivé ne donne aucun droit. */
  async lireDroits(id: string): Promise<{ _id: string; code: string; nom: string; permissions: Permission[] } | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const role = await RoleModel.findById(id).lean<DocumentRole>();
    if (!role) return null;
    return {
      _id: String(role._id),
      code: role.code,
      nom: role.nom,
      permissions: role.actif ? formater(role).permissions : [],
    };
  },

  /** Vérifie qu'un rôle existe et n'est pas archivé avant de l'attribuer à un utilisateur. */
  async verifierRoleAttribuable(id: string): Promise<void> {
    if (!(await RoleModel.exists({ _id: id, actif: true }))) {
      throw erreurs.donneesInvalides('Le rôle indiqué est introuvable ou archivé.', { champ: 'role_id' });
    }
  },

  async trouverIdParCode(code: string): Promise<string | null> {
    const role = await RoleModel.findOne({ code }, { _id: 1 }).lean<{ _id: Types.ObjectId }>();
    return role ? String(role._id) : null;
  },
};
