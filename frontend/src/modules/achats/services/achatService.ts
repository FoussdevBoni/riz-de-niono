import { clientHttp, type PageResultats, type ParametresRequete } from '../../../api/clientHttp';
import type { Achat, DonneesAchat } from '../types/achatTypes';

/**
 * Service du module achats : endpoints /api/v1/achats (document 04), partagé par les trois activités,
 * dont la validation, la réception (entrée en stock) et l'annulation avec motif.
 */
export const achatService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) => clientHttp.get<PageResultats<Achat>>('/achats', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<Achat>(`/achats/${id}`, undefined, signal),
  creer: (donnees: DonneesAchat) => clientHttp.post<Achat>('/achats', donnees),
  modifier: (id: string, donnees: DonneesAchat) => clientHttp.patch<Achat>(`/achats/${id}`, donnees),
  valider: (id: string) => clientHttp.post<Achat>(`/achats/${id}/validation`),
  receptionner: (id: string) => clientHttp.post<Achat>(`/achats/${id}/reception`),
  annuler: (id: string, motif: string) => clientHttp.post<Achat>(`/achats/${id}/annulation`, { motif }),
};
