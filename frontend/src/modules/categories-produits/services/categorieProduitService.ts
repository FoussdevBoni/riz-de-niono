import { clientHttp, type PageResultats, type ParametresRequete } from '../../../api/clientHttp';
import type { CategorieProduit, DonneesCategorieProduit } from '../types/categorieProduitTypes';

/**
 * Service du module categories-produits : endpoints /api/v1/categories-produits (document 04),
 * partagé par les trois activités. Seul ce service appelle le client HTTP pour ce module.
 */
export const categorieProduitService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<CategorieProduit>>('/categories-produits', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<CategorieProduit>(`/categories-produits/${id}`, undefined, signal),
  /** Code interne proposé à partir du nom (unicité garantie à la création). */
  proposerCode: (nom: string, signal?: AbortSignal) =>
    clientHttp.get<{ code: string }>('/categories-produits/code-propose', { nom }, signal),
  creer: (donnees: DonneesCategorieProduit) => clientHttp.post<CategorieProduit>('/categories-produits', donnees),
  modifier: (id: string, donnees: DonneesCategorieProduit) => clientHttp.patch<CategorieProduit>(`/categories-produits/${id}`, donnees),
};
