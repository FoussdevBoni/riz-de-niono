import type { TonPastille } from '../../../../components/PastilleStatut';
import type { StatutCommande } from '../types/commandeClientTypes';

export const STATUTS_COMMANDE: Record<StatutCommande, { libelle: string; ton: TonPastille }> = {
  en_cours: { libelle: 'En cours', ton: 'neutre' },
  en_expedition: { libelle: 'En expédition', ton: 'information' },
  livree: { libelle: 'Livrée', ton: 'succes' },
  annulee: { libelle: 'Annulée', ton: 'erreur' },
};

export const OPTIONS_STATUT_COMMANDE = (Object.keys(STATUTS_COMMANDE) as StatutCommande[]).map((statut) => ({
  valeur: statut,
  libelle: STATUTS_COMMANDE[statut].libelle,
}));
