import { clientHttp, type PageResultats, type ParametresRequete } from '../../../../api/clientHttp';
import type { Client, DonneesClient, FicheClient } from '../types/clientTypes';

/**
 * Service du module commercialisation/clients : endpoints /api/v1/clients (document 04).
 * Seul ce service appelle le client HTTP pour ce module ; pages, composants et hooks passent par lui.
 */
export const clientService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<Client>>('/clients', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<FicheClient>(`/clients/${id}`, undefined, signal),
  creer: (donnees: DonneesClient) => clientHttp.post<Client>('/clients', donnees),
  modifier: (id: string, donnees: DonneesClient) => clientHttp.patch<Client>(`/clients/${id}`, donnees),
};
