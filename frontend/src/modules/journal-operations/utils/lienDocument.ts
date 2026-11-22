import { possedeActivite, possedePermission } from '../../authentification/utils/permissions';
import type { Activite, Profil } from '../../profil/types/profilTypes';

/** Chemin de la fiche d'un document par collection : espace fixe, ou null pour les pages partagées sous /:activite. */
const PAGES: Record<string, { module: string; segment: string; espace: Activite | 'administration' | null }> = {
  utilisateurs: { module: 'utilisateurs', segment: 'utilisateurs', espace: 'administration' },
  roles: { module: 'roles', segment: 'roles', espace: 'administration' },
  sites_production: { module: 'sites_production', segment: 'sites-production', espace: 'production' },
  campagnes_agricoles: { module: 'campagnes_agricoles', segment: 'campagnes-agricoles', espace: 'production' },
  cultures: { module: 'cultures', segment: 'cultures', espace: 'production' },
  types_operations_agricoles: { module: 'types_operations_agricoles', segment: 'types-operations-agricoles', espace: 'production' },
  operations_agricoles: { module: 'operations_agricoles', segment: 'operations-agricoles', espace: 'production' },
  equipes_production: { module: 'equipes_production', segment: 'equipes-production', espace: 'production' },
  productions: { module: 'productions', segment: 'productions', espace: 'production' },
  unites_transformation: { module: 'unites_transformation', segment: 'unites-transformation', espace: 'transformation' },
  operations_transformation: { module: 'operations_transformation', segment: 'operations-transformation', espace: 'transformation' },
  commandes_clients: { module: 'commandes_clients', segment: 'commandes-clients', espace: 'commercialisation' },
  produits: { module: 'produits', segment: 'produits', espace: null },
  categories_produits: { module: 'categories_produits', segment: 'categories-produits', espace: null },
  fournisseurs: { module: 'fournisseurs', segment: 'fournisseurs', espace: null },
  achats: { module: 'achats', segment: 'achats', espace: null },
  reglements_fournisseurs: { module: 'reglements_fournisseurs', segment: 'reglements-fournisseurs', espace: null },
  materiels: { module: 'materiels', segment: 'materiels', espace: null },
  types_depenses: { module: 'types_depenses', segment: 'types-depenses', espace: null },
  depenses: { module: 'depenses', segment: 'depenses', espace: null },
  inventaires: { module: 'inventaires', segment: 'inventaires', espace: null },
  mouvements_stock: { module: 'stock', segment: 'mouvements-stock', espace: null },
  ventes: { module: 'ventes', segment: 'ventes', espace: null },
  clients: { module: 'clients', segment: 'clients', espace: null },
  encaissements: { module: 'encaissements', segment: 'encaissements', espace: null },
  retours_clients: { module: 'retours_clients', segment: 'retours-clients', espace: null },
};

const ESPACES: Activite[] = ['production', 'transformation', 'commercialisation'];

/**
 * Lien vers le document d'un événement du journal, si sa page est livrée et ouverte au profil. Une page partagée
 * s'ouvre dans le premier espace du profil qui la propose ; l'API contrôle encore le périmètre (404 sinon).
 */
export function lienDocument(profil: Profil | null, collection: string, id: string): string | null {
  const page = PAGES[collection];
  if (!page || !possedePermission(profil, page.module)) return null;
  if (collection === 'parametres_entreprise') return '/administration/parametres-entreprise';
  if (page.espace === 'administration') return `/administration/${page.segment}/${id}`;
  if (page.espace) return possedeActivite(profil, page.espace) ? `/${page.espace}/${page.segment}/${id}` : null;
  // Pages commerciales (clients, encaissements, retours, ventes) : production ou commercialisation seulement.
  const candidats = ['ventes', 'clients', 'encaissements', 'retours_clients'].includes(collection) ? ESPACES.filter((espace) => espace !== 'transformation') : ESPACES;
  const espace = candidats.find((element) => possedeActivite(profil, element));
  return espace ? `/${espace}/${page.segment}/${id}` : null;
}

/** Libellé lisible d'une collection. */
export const LIBELLES_COLLECTIONS: Record<string, string> = {
  utilisateurs: 'Utilisateur',
  roles: 'Rôle',
  parametres_entreprise: 'Paramètres de l’entreprise',
  sites_production: 'Site de production',
  campagnes_agricoles: 'Campagne agricole',
  cultures: 'Culture',
  types_operations_agricoles: 'Type d’opération agricole',
  operations_agricoles: 'Opération agricole',
  equipes_production: 'Équipe de production',
  productions: 'Récolte',
  unites_transformation: 'Unité de transformation',
  operations_transformation: 'Opération de transformation',
  commandes_clients: 'Commande client',
  produits: 'Produit',
  categories_produits: 'Catégorie de produits',
  fournisseurs: 'Fournisseur',
  achats: 'Achat',
  reglements_fournisseurs: 'Règlement fournisseur',
  materiels: 'Matériel',
  types_depenses: 'Type de dépense',
  depenses: 'Dépense',
  inventaires: 'Inventaire',
  mouvements_stock: 'Mouvement de stock',
  ventes: 'Vente',
  clients: 'Client',
  encaissements: 'Encaissement',
  retours_clients: 'Retour client',
};
