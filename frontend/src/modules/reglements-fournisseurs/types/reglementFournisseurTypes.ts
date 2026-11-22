import type { StatutOperation } from '../../production/productions/types/productionTypes';
import type { Activite } from '../../profil/types/profilTypes';

export type ModePaiement = 'especes' | 'virement' | 'cheque' | 'mobile_money';

/** Règlement renvoyé par /reglements-fournisseurs (document 04) ; il suit l'activité et le site de son achat. */
export interface ReglementFournisseur {
  _id: string;
  achat_id: string;
  activite: Activite;
  site_id: string | null;
  date_paiement: string;
  montant: string;
  mode: ModePaiement;
  reference: string | null;
  statut: StatutOperation;
  validated_at: string | null;
  validated_by_id: string | null;
  motif_annulation: string | null;
  annulee_at: string | null;
  annulee_par_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Fiche d'un règlement : situation de son achat (règlements validés uniquement). */
export interface FicheReglementFournisseur extends ReglementFournisseur {
  achat: { montant_total: string; montant_regle: string; solde_restant: string };
}

export interface DonneesReglementFournisseur {
  achat_id?: string;
  date_paiement?: string;
  montant?: string;
  mode?: ModePaiement;
  reference?: string | null;
}
