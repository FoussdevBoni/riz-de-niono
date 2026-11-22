import { clientHttp, type PageResultats, type ParametresRequete } from '../../../api/clientHttp';
import type { DonneesVente, Vente } from '../types/venteTypes';

/**
 * Service du module ventes : endpoints /api/v1/ventes (document 04), partagé par la production et la
 * commercialisation. Saisie directe, validation (sortie de stock) et annulation avec motif.
 */
export const venteService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) => clientHttp.get<PageResultats<Vente>>('/ventes', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<Vente>(`/ventes/${id}`, undefined, signal),
  creer: (donnees: DonneesVente) => clientHttp.post<Vente>('/ventes', donnees),
  modifier: (id: string, donnees: DonneesVente) => clientHttp.patch<Vente>(`/ventes/${id}`, donnees),
  valider: (id: string) => clientHttp.post<Vente>(`/ventes/${id}/validation`),
  annuler: (id: string, motif: string) => clientHttp.post<Vente>(`/ventes/${id}/annulation`, { motif }),
};
