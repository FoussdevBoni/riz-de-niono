import type { TonPastille } from '../../../components/PastilleStatut';
import type { StatutReception } from '../types/achatTypes';

export const STATUTS_RECEPTION: Record<StatutReception, { libelle: string; ton: TonPastille }> = {
  en_cours: { libelle: 'À réceptionner', ton: 'attention' },
  recu: { libelle: 'Reçu', ton: 'succes' },
};

export const OPTIONS_RECEPTION = (Object.keys(STATUTS_RECEPTION) as StatutReception[]).map((statut) => ({
  valeur: statut,
  libelle: STATUTS_RECEPTION[statut].libelle,
}));
