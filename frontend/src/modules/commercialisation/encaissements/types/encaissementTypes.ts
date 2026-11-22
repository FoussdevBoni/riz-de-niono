import type { StatutOperation } from '../../../production/productions/types/productionTypes';
import type { ModePaiement } from '../../../reglements-fournisseurs/types/reglementFournisseurTypes';
import type { SituationVente } from '../../../ventes/types/venteTypes';

/** Encaissement renvoyé par /encaissements (document 04) ; il suit l'activité de sa vente. */
export interface Encaissement {
  _id: string;
  vente_id: string;
  activite: string;
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

export interface FicheEncaissement extends Encaissement {
  vente: SituationVente;
}

export interface DonneesEncaissement {
  vente_id?: string;
  date_paiement?: string;
  montant?: string;
  mode?: ModePaiement;
  reference?: string | null;
}
