import type { StatutOperation } from '../../production/productions/types/productionTypes';

export type ActiviteVente = 'production' | 'commercialisation';

/** Situation d'une vente : solde négatif = trop-perçu (né d'un retour validé). */
export interface SituationVente {
  montant_total: string;
  montant_encaisse: string;
  montant_retours: string;
  solde: string;
  trop_percu: string;
}

export interface LigneVente {
  ligne_id: string;
  produit_id: string;
  produit_nom?: string | null;
  quantite: string;
  prix_unitaire: string;
  montant: string;
  quantite_retournee: string;
}

/** Vente renvoyée par /ventes (document 04). */
export interface Vente extends SituationVente {
  _id: string;
  client_id: string;
  commande_id: string | null;
  activite: ActiviteVente;
  date_vente: string;
  lignes: LigneVente[];
  statut: StatutOperation;
  validated_at: string | null;
  validated_by_id: string | null;
  motif_annulation: string | null;
  annulee_at: string | null;
  annulee_par_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Ligne saisie d'une vente ou d'une commande : un prix omis reprend le prix catalogue du produit. */
export interface LigneVenteSaisie {
  produit_id: string;
  produit_nom?: string | null;
  quantite: string;
  prix_unitaire?: string;
}

export interface DonneesVente {
  client_id?: string;
  activite?: ActiviteVente;
  date_vente?: string;
  lignes?: LigneVenteSaisie[];
}
