import { useActiviteCourante } from '../../../hooks/useActiviteCourante';
import type { ActiviteVente } from '../types/venteTypes';

/**
 * Espace des pages de vente, clients, encaissements et retours : production ou commercialisation
 * (document 05). Les liens et les listes de ces pages suivent l'espace ouvert.
 */
export function useEspaceVente(): ActiviteVente {
  return useActiviteCourante() === 'production' ? 'production' : 'commercialisation';
}
