import type { LigneVenteSaisie } from '../../../ventes/types/venteTypes';

export type StatutCommande = 'en_cours' | 'en_expedition' | 'livree' | 'annulee';

export interface LigneCommande {
  ligne_id: string;
  produit_id: string;
  produit_nom?: string | null;
  quantite: string;
  prix_unitaire: string;
  montant: string;
}

/** Commande renvoyée par /commandes-clients (document 04) ; vente_id est renseigné après livraison. */
export interface CommandeClient {
  _id: string;
  client_id: string;
  date_commande: string;
  lignes: LigneCommande[];
  montant_total: string;
  statut: StatutCommande;
  expediee_at: string | null;
  livree_at: string | null;
  livree_par_id: string | null;
  vente_id: string | null;
  motif_annulation: string | null;
  annulee_at: string | null;
  annulee_par_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DonneesCommandeClient {
  client_id?: string;
  date_commande?: string;
  lignes?: LigneVenteSaisie[];
}
