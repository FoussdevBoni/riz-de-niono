import type { TonPastille } from '../../../../components/PastilleStatut';
import type { StatutOperation } from '../types/productionTypes';

export const STATUTS_PRODUCTION: Record<StatutOperation, { libelle: string; ton: TonPastille }> = {
  brouillon: { libelle: 'Brouillon', ton: 'neutre' },
  validee: { libelle: 'Validée', ton: 'succes' },
  annulee: { libelle: 'Annulée', ton: 'erreur' },
};

export const OPTIONS_STATUT_PRODUCTION = (Object.keys(STATUTS_PRODUCTION) as StatutOperation[]).map((statut) => ({
  valeur: statut,
  libelle: STATUTS_PRODUCTION[statut].libelle,
}));
