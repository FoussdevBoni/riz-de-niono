import { clientHttp, type PageResultats, type ParametresRequete } from '../../../api/clientHttp';
import type { DonneesInventaire, Inventaire } from '../types/inventaireTypes';

/**
 * Service du module inventaires : endpoints /api/v1/inventaires (document 04), partagé par les trois activités.
 * La validation applique les écarts si le stock n'a pas changé depuis le relevé (sinon 409 stock_modifie).
 */
export const inventaireService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<Inventaire>>('/inventaires', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<Inventaire>(`/inventaires/${id}`, undefined, signal),
  creer: (donnees: DonneesInventaire) => clientHttp.post<Inventaire>('/inventaires', donnees),
  modifier: (id: string, donnees: DonneesInventaire) => clientHttp.patch<Inventaire>(`/inventaires/${id}`, donnees),
  valider: (id: string) => clientHttp.post<Inventaire>(`/inventaires/${id}/validation`),
  annuler: (id: string, motif: string) => clientHttp.post<Inventaire>(`/inventaires/${id}/annulation`, { motif }),
};
