import { clientHttp, type PageResultats, type ParametresRequete } from '../../../api/clientHttp';
import type { DonneesProduit, Produit } from '../types/produitTypes';

/**
 * Service du module produits : endpoints /api/v1/produits (document 04), partagé par les trois activités.
 * Seul ce service appelle le client HTTP pour ce module ; pages, composants et hooks passent par lui.
 */
export const produitService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<Produit>>('/produits', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<Produit>(`/produits/${id}`, undefined, signal),
  /** Code interne proposé à partir du nom (unicité garantie à la création). */
  proposerCode: (nom: string, signal?: AbortSignal) =>
    clientHttp.get<{ code: string }>('/produits/code-propose', { nom }, signal),
  creer: (donnees: DonneesProduit) => clientHttp.post<Produit>('/produits', donnees),
  modifier: (id: string, donnees: DonneesProduit) => clientHttp.patch<Produit>(`/produits/${id}`, donnees),
};
