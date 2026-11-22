import type { TonPastille } from '../../../../components/PastilleStatut';
import type { StatutCampagne } from '../types/campagneAgricoleTypes';

export const STATUTS_CAMPAGNE: Record<StatutCampagne, { libelle: string; ton: TonPastille }> = {
  brouillon: { libelle: 'Brouillon', ton: 'neutre' },
  ouverte: { libelle: 'Ouverte', ton: 'succes' },
  cloturee: { libelle: 'Clôturée', ton: 'information' },
};

export const OPTIONS_STATUT_CAMPAGNE = (Object.keys(STATUTS_CAMPAGNE) as StatutCampagne[]).map((statut) => ({
  valeur: statut,
  libelle: STATUTS_CAMPAGNE[statut].libelle,
}));
