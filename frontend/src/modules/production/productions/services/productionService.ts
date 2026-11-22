import { clientHttp, type PageResultats, type ParametresRequete } from '../../../../api/clientHttp';
import type { DonneesProduction, Production } from '../types/productionTypes';

/**
 * Service du module production/productions : endpoints /api/v1/productions (document 04),
 * dont la validation (entrée en stock) et l'annulation avec motif.
 */
export const productionService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<Production>>('/productions', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<Production>(`/productions/${id}`, undefined, signal),
  creer: (donnees: DonneesProduction) => clientHttp.post<Production>('/productions', donnees),
  modifier: (id: string, donnees: DonneesProduction) => clientHttp.patch<Production>(`/productions/${id}`, donnees),
  valider: (id: string) => clientHttp.post<Production>(`/productions/${id}/validation`),
  annuler: (id: string, motif: string) => clientHttp.post<Production>(`/productions/${id}/annulation`, { motif }),
};
