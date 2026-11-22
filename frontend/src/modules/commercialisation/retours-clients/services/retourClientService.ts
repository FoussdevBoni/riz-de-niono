import { clientHttp, type PageResultats, type ParametresRequete } from '../../../../api/clientHttp';
import type { DonneesRetourClient, FicheRetourClient, RetourClient } from '../types/retourClientTypes';

/**
 * Service du module commercialisation/retours-clients : endpoints /api/v1/retours-clients (document 04),
 * dont la validation (remise en stock du revendable, déduction du dû) et l'annulation avec motif.
 */
export const retourClientService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<RetourClient>>('/retours-clients', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<FicheRetourClient>(`/retours-clients/${id}`, undefined, signal),
  creer: (donnees: DonneesRetourClient) => clientHttp.post<RetourClient>('/retours-clients', donnees),
  modifier: (id: string, donnees: DonneesRetourClient) => clientHttp.patch<RetourClient>(`/retours-clients/${id}`, donnees),
  valider: (id: string) => clientHttp.post<RetourClient>(`/retours-clients/${id}/validation`),
  annuler: (id: string, motif: string) => clientHttp.post<RetourClient>(`/retours-clients/${id}/annulation`, { motif }),
};
