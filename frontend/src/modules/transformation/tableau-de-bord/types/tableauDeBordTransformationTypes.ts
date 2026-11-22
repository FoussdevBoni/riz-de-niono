/** Réponse de GET /tableaux-de-bord/transformation (document 04). */
export interface TableauDeBordTransformation {
  filtres: { unite_transformation_id: string | null; date_debut: string | null; date_fin: string | null };
  operations_validees: number;
  paddy_consomme: { produit_id: string; produit_nom?: string | null; unite_stock: string | null; quantite: string }[];
  produits_obtenus: { produit_id: string; produit_nom?: string | null; unite_stock: string | null; quantite: string; rendement_pct: string | null }[];
  depenses_directes: string;
}

export interface FiltresTableauTransformation {
  unite_transformation_id?: string;
  date_debut?: string;
  date_fin?: string;
}
