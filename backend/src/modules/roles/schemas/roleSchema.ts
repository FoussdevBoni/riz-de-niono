import { Schema } from 'mongoose';

/** Modules soumis à permission (documents 01 et 05). Les codes reprennent les noms de collection. */
export const MODULES_PERMISSIONS = [
  'utilisateurs',
  'roles',
  'journal_operations',
  'parametres_entreprise',
  'produits',
  'categories_produits',
  'fournisseurs',
  'achats',
  'reglements_fournisseurs',
  'materiels',
  'types_depenses',
  'depenses',
  'stock',
  'inventaires',
  'ventes',
  'campagnes_agricoles',
  'sites_production',
  'cultures',
  'types_operations_agricoles',
  'operations_agricoles',
  'equipes_production',
  'productions',
  'tableau_de_bord_production',
  'unites_transformation',
  'operations_transformation',
  'tableau_de_bord_transformation',
  'clients',
  'commandes_clients',
  'encaissements',
  'retours_clients',
  'tableau_de_bord_commercialisation',
] as const;

/** Actions attribuables par module (document 01, Rôles et permissions). */
export const ACTIONS_PERMISSIONS = ['consultation', 'saisie', 'validation', 'cloture', 'administration'] as const;

export type CodeModule = (typeof MODULES_PERMISSIONS)[number];
export type CodeAction = (typeof ACTIONS_PERMISSIONS)[number];

export interface Permission {
  module: CodeModule;
  action: CodeAction;
}

const permissionSchema = new Schema(
  {
    module: { type: String, enum: MODULES_PERMISSIONS, required: true },
    action: { type: String, enum: ACTIONS_PERMISSIONS, required: true },
  },
  { _id: false },
);

export const roleSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    nom: { type: String, required: true, trim: true },
    permissions: { type: [permissionSchema], default: [] },
    actif: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);
