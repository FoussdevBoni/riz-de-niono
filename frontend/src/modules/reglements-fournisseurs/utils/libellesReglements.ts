import type { ModePaiement } from '../types/reglementFournisseurTypes';

export const LIBELLES_MODES: Record<ModePaiement, string> = {
  especes: 'Espèces',
  virement: 'Virement',
  cheque: 'Chèque',
  mobile_money: 'Mobile money',
};

export const OPTIONS_MODES = (Object.keys(LIBELLES_MODES) as ModePaiement[]).map((mode) => ({ valeur: mode, libelle: LIBELLES_MODES[mode] }));
