import type { StatutOperation } from '../../../production/productions/types/productionTypes';

export interface ResultatTransformation {
  ligne_id: string;
  produit_id: string;
  produit_nom?: string | null;
  quantite: string;
}

/** Opération renvoyée par /operations-transformation (document 04). */
export interface OperationTransformation {
  _id: string;
  unite_transformation_id: string;
  date_operation: string;
  paddy_produit_id: string;
  paddy_produit_nom?: string | null;
  quantite_paddy: string;
  resultats: ResultatTransformation[];
  note_ecart: string | null;
  statut: StatutOperation;
  validated_at: string | null;
  validated_by_id: string | null;
  motif_annulation: string | null;
  annulee_at: string | null;
  annulee_par_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Saisie d'une opération : les résultats transmis remplacent toutes les lignes. */
export interface DonneesOperationTransformation {
  unite_transformation_id?: string;
  date_operation?: string;
  paddy_produit_id?: string;
  quantite_paddy?: string;
  resultats?: { produit_id: string; quantite: string }[];
  note_ecart?: string | null;
}
