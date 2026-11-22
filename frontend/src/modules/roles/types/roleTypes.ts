import type { CodeAction, Permission } from '../../profil/types/profilTypes';

/** Rôle renvoyé par /roles (document 04). */
export interface Role {
  _id: string;
  code: string;
  nom: string;
  permissions: Permission[];
  actif: boolean;
  created_at: string;
  updated_at: string;
}

/** Les permissions transmises remplacent toutes les permissions du rôle. */
export interface DonneesRole {
  code?: string;
  nom?: string;
  permissions?: Permission[];
  actif?: boolean;
}

export const ACTIONS: { code: CodeAction; libelle: string }[] = [
  { code: 'consultation', libelle: 'Consultation' },
  { code: 'saisie', libelle: 'Saisie' },
  { code: 'validation', libelle: 'Validation' },
  { code: 'cloture', libelle: 'Clôture' },
  { code: 'administration', libelle: 'Administration' },
];

/** Catalogue des modules soumis à permission (document 03), regroupés comme dans les menus. */
export const GROUPES_MODULES: { titre: string; modules: { code: string; libelle: string }[] }[] = [
  {
    titre: 'Administration',
    modules: [
      { code: 'utilisateurs', libelle: 'Utilisateurs' },
      { code: 'roles', libelle: 'Rôles et permissions' },
      { code: 'journal_operations', libelle: 'Journal des opérations' },
      { code: 'parametres_entreprise', libelle: 'Paramètres de l’entreprise' },
    ],
  },
  {
    titre: 'Référentiels, achats et stock',
    modules: [
      { code: 'produits', libelle: 'Produits' },
      { code: 'categories_produits', libelle: 'Catégories de produits' },
      { code: 'fournisseurs', libelle: 'Fournisseurs' },
      { code: 'achats', libelle: 'Achats' },
      { code: 'reglements_fournisseurs', libelle: 'Règlements fournisseurs' },
      { code: 'materiels', libelle: 'Matériel' },
      { code: 'types_depenses', libelle: 'Types de dépenses' },
      { code: 'depenses', libelle: 'Dépenses' },
      { code: 'stock', libelle: 'Stock et mouvements' },
      { code: 'inventaires', libelle: 'Inventaires' },
      { code: 'ventes', libelle: 'Ventes' },
    ],
  },
  {
    titre: 'Production',
    modules: [
      { code: 'tableau_de_bord_production', libelle: 'Tableau de bord' },
      { code: 'campagnes_agricoles', libelle: 'Campagnes agricoles' },
      { code: 'sites_production', libelle: 'Sites de production' },
      { code: 'cultures', libelle: 'Cultures' },
      { code: 'types_operations_agricoles', libelle: 'Types d’opérations agricoles' },
      { code: 'operations_agricoles', libelle: 'Opérations agricoles' },
      { code: 'equipes_production', libelle: 'Équipes de production' },
      { code: 'productions', libelle: 'Productions' },
    ],
  },
  {
    titre: 'Transformation',
    modules: [
      { code: 'tableau_de_bord_transformation', libelle: 'Tableau de bord' },
      { code: 'unites_transformation', libelle: 'Unités de transformation' },
      { code: 'operations_transformation', libelle: 'Opérations de transformation' },
    ],
  },
  {
    titre: 'Commercialisation',
    modules: [
      { code: 'tableau_de_bord_commercialisation', libelle: 'Tableau de bord' },
      { code: 'clients', libelle: 'Clients' },
      { code: 'commandes_clients', libelle: 'Commandes clients' },
      { code: 'encaissements', libelle: 'Encaissements' },
      { code: 'retours_clients', libelle: 'Retours clients' },
    ],
  },
];

export const LIBELLES_MODULES: Record<string, string> = Object.fromEntries(
  GROUPES_MODULES.flatMap((groupe) => groupe.modules.map((module) => [module.code, module.libelle])),
);
