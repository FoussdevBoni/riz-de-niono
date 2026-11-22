import type { StatutOperation } from '../../productions/types/productionTypes';

export interface IntrantOperation {
  ligne_id: string;
  produit_id: string;
  produit_nom?: string | null;
  quantite: string;
}

/** Travail renvoyé par /operations-agricoles (document 04). */
export interface OperationAgricole {
  _id: string;
  campagne_id: string;
  site_id: string;
  type_operation_id: string;
  equipe_id: string | null;
  date_operation: string;
  journees_travail: string | null;
  cout_main_oeuvre: string | null;
  intrants: IntrantOperation[];
  statut: StatutOperation;
  validated_at: string | null;
  validated_by_id: string | null;
  motif_annulation: string | null;
  annulee_at: string | null;
  annulee_par_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Saisie d'un travail : les intrants transmis remplacent toutes les lignes. */
export interface DonneesOperationAgricole {
  campagne_id?: string;
  site_id?: string;
  type_operation_id?: string;
  equipe_id?: string | null;
  date_operation?: string;
  journees_travail?: string | null;
  cout_main_oeuvre?: string | null;
  intrants?: { produit_id: string; quantite: string }[];
}
