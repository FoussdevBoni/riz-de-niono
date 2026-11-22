export type SensMouvement = 'entree' | 'sortie';

export type TypeOrigine =
  | 'production'
  | 'operation_agricole'
  | 'achat'
  | 'operation_transformation'
  | 'vente'
  | 'retour_client'
  | 'inventaire'
  | 'manuel'
  | 'correction';

/** Solde global d'un produit (GET /stock). */
export interface StockProduit {
  _id: string;
  produit_id: string;
  produit_nom?: string | null;
  unite_stock: string | null;
  quantite_disponible: string;
  updated_at: string;
}

/** Mouvement de stock (GET /mouvements-stock). */
export interface MouvementStock {
  _id: string;
  produit_id: string;
  produit_nom?: string | null;
  sens: SensMouvement;
  quantite: string;
  date_mouvement: string;
  origine_type: TypeOrigine;
  origine_id: string;
  ligne_id: string | null;
  cle_mouvement: string;
  annule_mouvement_id: string | null;
  motif: string | null;
  utilisateur_id: string | null;
  created_at: string;
}

/** Fiche d'un mouvement : référence d'origine et contre-écriture éventuelle. */
export interface FicheMouvementStock extends MouvementStock {
  origine: { type: TypeOrigine; id: string };
  contre_ecriture_id: string | null;
}
