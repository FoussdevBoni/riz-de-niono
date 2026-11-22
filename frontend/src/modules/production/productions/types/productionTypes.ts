export type StatutOperation = 'brouillon' | 'validee' | 'annulee';

/** Récolte renvoyée par /productions (document 04). */
export interface Production {
  _id: string;
  campagne_id: string;
  site_id: string;
  produit_id: string;
  produit_nom?: string | null;
  date_recolte: string;
  superficie_recoltee_ha: string;
  quantite: string;
  statut: StatutOperation;
  validated_at: string | null;
  validated_by_id: string | null;
  motif_annulation: string | null;
  annulee_at: string | null;
  annulee_par_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DonneesProduction {
  campagne_id?: string;
  site_id?: string;
  produit_id?: string;
  date_recolte?: string;
  superficie_recoltee_ha?: string;
  quantite?: string;
}
