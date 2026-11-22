import type { StatutOperation } from '../../production/productions/types/productionTypes';
import type { Activite } from '../../profil/types/profilTypes';

export type StatutReception = 'en_cours' | 'recu';

export interface LigneAchat {
  ligne_id: string;
  libelle: string;
  /** null : prestation ou article non référencé (sans effet de stock). */
  produit_id: string | null;
  produit_nom?: string | null;
  quantite: string;
  prix_unitaire: string;
  montant: string;
}

/** Achat renvoyé par /achats (document 04), avec ses montants calculés par l'API. */
export interface Achat {
  _id: string;
  activite: Activite;
  fournisseur_id: string;
  date_achat: string;
  site_id: string | null;
  campagne_id: string | null;
  unite_transformation_id: string | null;
  lignes: LigneAchat[];
  montant_total: string;
  montant_regle: string;
  solde_restant: string;
  statut: StatutOperation;
  statut_reception: StatutReception | null;
  recu_at: string | null;
  recu_par_id: string | null;
  validated_at: string | null;
  validated_by_id: string | null;
  motif_annulation: string | null;
  annulee_at: string | null;
  annulee_par_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LigneAchatSaisie {
  libelle: string;
  produit_id: string | null;
  produit_nom?: string | null;
  quantite: string;
  prix_unitaire: string;
}

/** Saisie d'un achat : les lignes transmises remplacent toutes les lignes. */
export interface DonneesAchat {
  activite?: Activite;
  fournisseur_id?: string;
  date_achat?: string;
  site_id?: string | null;
  campagne_id?: string | null;
  unite_transformation_id?: string | null;
  lignes?: LigneAchatSaisie[];
}
