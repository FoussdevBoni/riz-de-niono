import type { StatutOperation } from '../../production/productions/types/productionTypes';

export interface LigneInventaire {
  ligne_id: string;
  produit_id: string;
  produit_nom?: string | null;
  /** Stock relevé par le serveur à la saisie ou à la dernière modification des lignes. */
  quantite_theorique: string;
  version_stock: number;
  quantite_comptee: string;
  /** Compté − théorique : positif, entrée d'ajustement ; négatif, sortie. */
  ecart: string;
  motif_ecart: string | null;
}

/** Inventaire renvoyé par /inventaires (document 04) ; le stock étant global, il n'a ni activité ni site. */
export interface Inventaire {
  _id: string;
  date_inventaire: string;
  lignes: LigneInventaire[];
  statut: StatutOperation;
  validated_at: string | null;
  validated_by_id: string | null;
  motif_annulation: string | null;
  annulee_at: string | null;
  annulee_par_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LigneInventaireSaisie {
  produit_id: string;
  produit_nom?: string | null;
  quantite_comptee: string;
  motif_ecart?: string | null;
}

/** Les lignes transmises remplacent toutes les lignes et refont le relevé du stock théorique. */
export interface DonneesInventaire {
  date_inventaire?: string;
  lignes?: LigneInventaireSaisie[];
}
