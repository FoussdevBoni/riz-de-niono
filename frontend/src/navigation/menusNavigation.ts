/**
 * Espaces métier, menus et module de permission de chaque page (documents 04 et 05).
 * Les menus et les gardes de routes utilisent la même définition : une URL ouverte directement
 * exige les mêmes droits que l'entrée de menu correspondante.
 */
import { possedeActivite, possedePermission } from '../modules/authentification/utils/permissions';
import type { Activite, Profil } from '../modules/profil/types/profilTypes';

export type CodeActivite = Activite;

export interface EntreeMenu {
  libelle: string;
  /** Segment de route relatif à l'espace, avec des tirets (« reglements-fournisseurs »). */
  chemin: string;
  /** Module dont la consultation est exigée (code de permission, document 03). */
  module: string;
}

export interface SectionMenu {
  titre: string;
  entrees: EntreeMenu[];
  secondaire?: boolean;
}

export interface EspaceActivite {
  code: CodeActivite;
  libelle: string;
  /** Contexte de travail de l'espace (document 05). */
  contexte: string;
  sections: SectionMenu[];
}

const achatsEtDepenses: SectionMenu = {
  titre: 'Achats et dépenses',
  entrees: [
    { libelle: 'Achats', chemin: 'achats', module: 'achats' },
    { libelle: 'Règlements fournisseurs', chemin: 'reglements-fournisseurs', module: 'reglements_fournisseurs' },
    { libelle: 'Dépenses', chemin: 'depenses', module: 'depenses' },
  ],
};

const stock: SectionMenu = {
  titre: 'Stock',
  entrees: [
    { libelle: 'Stock disponible', chemin: 'stock', module: 'stock' },
    { libelle: 'Mouvements de stock', chemin: 'mouvements-stock', module: 'stock' },
    { libelle: 'Inventaires', chemin: 'inventaires', module: 'inventaires' },
  ],
};

const materiel: EntreeMenu = { libelle: 'Matériel', chemin: 'materiels', module: 'materiels' };
const clients: EntreeMenu = { libelle: 'Clients', chemin: 'clients', module: 'clients' };
const fournisseurs: EntreeMenu = { libelle: 'Fournisseurs', chemin: 'fournisseurs', module: 'fournisseurs' };

/** Catalogue commun : produits et nomenclatures utilisés par les saisies. */
function catalogue(entrees: EntreeMenu[] = []): SectionMenu {
  return {
    titre: 'Catalogue',
    secondaire: true,
    entrees: [
      { libelle: 'Produits', chemin: 'produits', module: 'produits' },
      { libelle: 'Catégories de produits', chemin: 'categories-produits', module: 'categories_produits' },
      ...entrees,
      { libelle: 'Types de dépenses', chemin: 'types-depenses', module: 'types_depenses' },
    ],
  };
}

const ventes: EntreeMenu = { libelle: 'Ventes', chemin: 'ventes', module: 'ventes' };

export const CHEMIN_TABLEAU_DE_BORD = 'tableau-de-bord';

/**
 * Les sections suivent le sens métier de chaque activité : pilotage, opérations courantes, stock,
 * achats, puis ressources opérationnelles, partenaires et catalogue (aucune rubrique « réglages »).
 */
export const espacesActivites: EspaceActivite[] = [
  {
    code: 'production',
    libelle: 'Production',
    contexte: 'Site et campagne',
    sections: [
      {
        titre: 'Pilotage',
        entrees: [{ libelle: 'Tableau de bord', chemin: CHEMIN_TABLEAU_DE_BORD, module: 'tableau_de_bord_production' }],
      },
      {
        titre: 'Campagne agricole',
        entrees: [
          { libelle: 'Campagnes agricoles', chemin: 'campagnes-agricoles', module: 'campagnes_agricoles' },
          { libelle: 'Cultures', chemin: 'cultures', module: 'cultures' },
          { libelle: 'Travaux agricoles', chemin: 'operations-agricoles', module: 'operations_agricoles' },
          { libelle: 'Récoltes', chemin: 'productions', module: 'productions' },
        ],
      },
      stock,
      achatsEtDepenses,
      {
        titre: 'Ventes directes',
        entrees: [
          ventes,
          // Ventes directes de la production : mêmes écrans qu'en commercialisation, sur les écritures de la production.
          { libelle: 'Encaissements', chemin: 'encaissements', module: 'encaissements' },
          { libelle: 'Retours clients', chemin: 'retours-clients', module: 'retours_clients' },
        ],
      },
      {
        titre: 'Ressources',
        entrees: [
          { libelle: 'Sites de production', chemin: 'sites-production', module: 'sites_production' },
          { libelle: 'Équipes de production', chemin: 'equipes-production', module: 'equipes_production' },
          materiel,
        ],
      },
      { titre: 'Partenaires', entrees: [clients, fournisseurs] },
      catalogue([{ libelle: 'Types de travaux agricoles', chemin: 'types-operations-agricoles', module: 'types_operations_agricoles' }]),
    ],
  },
  {
    code: 'transformation',
    libelle: 'Transformation',
    contexte: 'Unité et période',
    sections: [
      {
        titre: 'Pilotage',
        entrees: [{ libelle: 'Tableau de bord', chemin: CHEMIN_TABLEAU_DE_BORD, module: 'tableau_de_bord_transformation' }],
      },
      {
        titre: 'Transformation',
        entrees: [{ libelle: 'Opérations de transformation', chemin: 'operations-transformation', module: 'operations_transformation' }],
      },
      stock,
      achatsEtDepenses,
      {
        titre: 'Ressources',
        entrees: [{ libelle: 'Unités de transformation', chemin: 'unites-transformation', module: 'unites_transformation' }, materiel],
      },
      { titre: 'Partenaires', entrees: [fournisseurs] },
      catalogue(),
    ],
  },
  {
    code: 'commercialisation',
    libelle: 'Commercialisation',
    contexte: 'Période et client',
    sections: [
      {
        titre: 'Pilotage',
        entrees: [{ libelle: 'Tableau de bord', chemin: CHEMIN_TABLEAU_DE_BORD, module: 'tableau_de_bord_commercialisation' }],
      },
      {
        titre: 'Ventes',
        entrees: [
          { libelle: 'Commandes clients', chemin: 'commandes-clients', module: 'commandes_clients' },
          ventes,
          { libelle: 'Encaissements', chemin: 'encaissements', module: 'encaissements' },
          { libelle: 'Retours clients', chemin: 'retours-clients', module: 'retours_clients' },
        ],
      },
      stock,
      achatsEtDepenses,
      { titre: 'Partenaires', entrees: [clients, fournisseurs] },
      { titre: 'Ressources', entrees: [materiel] },
      catalogue(),
    ],
  },
];

export const menuAdministration: SectionMenu = {
  titre: 'Administration',
  entrees: [
    { libelle: 'Utilisateurs', chemin: 'utilisateurs', module: 'utilisateurs' },
    { libelle: 'Rôles et permissions', chemin: 'roles', module: 'roles' },
    { libelle: 'Journal des opérations', chemin: 'journal-operations', module: 'journal_operations' },
    { libelle: "Paramètres de l'entreprise", chemin: 'parametres-entreprise', module: 'parametres_entreprise' },
  ],
};

export function trouverEspace(code: string | undefined): EspaceActivite | undefined {
  return espacesActivites.find((espace) => espace.code === code);
}

/** Espaces dont l'activité appartient au périmètre de l'utilisateur. */
export function espacesAutorises(profil: Profil | null): EspaceActivite[] {
  return espacesActivites.filter((espace) => possedeActivite(profil, espace.code));
}

/** Sections d'un menu réduites aux entrées que l'utilisateur peut consulter (sections vides retirées). */
export function filtrerSections(profil: Profil | null, sections: SectionMenu[]): SectionMenu[] {
  return sections
    .map((section) => ({ ...section, entrees: section.entrees.filter((entree) => possedePermission(profil, entree.module)) }))
    .filter((section) => section.entrees.length > 0);
}

/**
 * Page d'entrée : le tableau de bord du premier espace autorisé, sinon la première page accessible
 * d'un espace, sinon l'administration, sinon le profil.
 */
export function destinationAccueil(profil: Profil | null): string {
  const espaces = espacesAutorises(profil);
  for (const espace of espaces) {
    const tableau = espace.sections[0]!.entrees.find((entree) => entree.chemin === CHEMIN_TABLEAU_DE_BORD)!;
    if (possedePermission(profil, tableau.module)) return `/${espace.code}/${CHEMIN_TABLEAU_DE_BORD}`;
  }
  for (const espace of espaces) {
    const premiere = filtrerSections(profil, espace.sections)[0]?.entrees[0];
    if (premiere) return `/${espace.code}/${premiere.chemin}`;
  }
  const administration = filtrerSections(profil, [menuAdministration])[0]?.entrees[0];
  return administration ? `/administration/${administration.chemin}` : '/profil';
}
