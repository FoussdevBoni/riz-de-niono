import type { StatutOperation } from '../../../production/productions/types/productionTypes';
import type { SituationVente } from '../../../ventes/types/venteTypes';

export interface LigneRetour {
  ligne_id: string;
  ligne_vente_id: string;
  produit_id: string;
  produit_nom?: string | null;
  quantite: string;
  quantite_revendable: string;
  prix_unitaire: string;
  montant: string;
  motif: string;
}

/** Retour renvoyé par /retours-clients (document 04). */
export interface RetourClient {
  _id: string;
  vente_id: string;
  activite: string;
  date_retour: string;
  lignes: LigneRetour[];
  montant: string;
  statut: StatutOperation;
  validated_at: string | null;
  validated_by_id: string | null;
  motif_annulation: string | null;
  annulee_at: string | null;
  annulee_par_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FicheRetourClient extends RetourClient {
  vente: SituationVente;
}

/** Ligne saisie : quantite_revendable ≤ quantite ≤ quantité encore retournable (422 sinon). */
export interface LigneRetourSaisie {
  ligne_vente_id: string;
  quantite: string;
  quantite_revendable: string;
  motif: string;
}

export interface DonneesRetourClient {
  vente_id?: string;
  date_retour?: string;
  lignes?: LigneRetourSaisie[];
}
