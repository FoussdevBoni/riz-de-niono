import type { SensMouvement, TypeOrigine } from '../types/stockTypes';

export const LIBELLES_SENS: Record<SensMouvement, string> = { entree: 'Entrée', sortie: 'Sortie' };

export const LIBELLES_ORIGINE: Record<TypeOrigine, string> = {
  production: 'Récolte',
  operation_agricole: 'Opération agricole',
  achat: 'Achat',
  operation_transformation: 'Transformation',
  vente: 'Vente',
  retour_client: 'Retour client',
  inventaire: 'Inventaire',
  manuel: 'Écriture manuelle',
  correction: 'Correction',
};

export const OPTIONS_SENS = (Object.keys(LIBELLES_SENS) as SensMouvement[]).map((sens) => ({ valeur: sens, libelle: LIBELLES_SENS[sens] }));

export const OPTIONS_ORIGINE = (Object.keys(LIBELLES_ORIGINE) as TypeOrigine[]).map((type) => ({
  valeur: type,
  libelle: LIBELLES_ORIGINE[type],
}));
