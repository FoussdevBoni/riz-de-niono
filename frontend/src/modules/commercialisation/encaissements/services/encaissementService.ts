import { clientHttp, type PageResultats, type ParametresRequete } from '../../../../api/clientHttp';
import type { DonneesEncaissement, Encaissement, FicheEncaissement } from '../types/encaissementTypes';

/**
 * Service du module commercialisation/encaissements : endpoints /api/v1/encaissements (document 04),
 * dont la validation (refusée au-delà du solde dû) et l'annulation avec motif.
 */
export const encaissementService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<Encaissement>>('/encaissements', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<FicheEncaissement>(`/encaissements/${id}`, undefined, signal),
  creer: (donnees: DonneesEncaissement) => clientHttp.post<Encaissement>('/encaissements', donnees),
  modifier: (id: string, donnees: DonneesEncaissement) => clientHttp.patch<Encaissement>(`/encaissements/${id}`, donnees),
  valider: (id: string) => clientHttp.post<Encaissement>(`/encaissements/${id}/validation`),
  annuler: (id: string, motif: string) => clientHttp.post<Encaissement>(`/encaissements/${id}/annulation`, { motif }),
};
