import { clientHttp, type PageResultats, type ParametresRequete } from '../../../../api/clientHttp';
import type { DonneesUniteTransformation, UniteTransformation } from '../types/uniteTransformationTypes';

/**
 * Service du module transformation/unites-transformation : endpoints /api/v1/unites-transformation (document 04).
 * Seul ce service appelle le client HTTP pour ce module ; pages, composants et hooks passent par lui.
 */
export const uniteTransformationService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<UniteTransformation>>('/unites-transformation', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<UniteTransformation>(`/unites-transformation/${id}`, undefined, signal),
  /** Code interne proposé à partir du nom (unicité garantie à la création). */
  proposerCode: (nom: string, signal?: AbortSignal) =>
    clientHttp.get<{ code: string }>('/unites-transformation/code-propose', { nom }, signal),
  creer: (donnees: DonneesUniteTransformation) => clientHttp.post<UniteTransformation>('/unites-transformation', donnees),
  modifier: (id: string, donnees: DonneesUniteTransformation) =>
    clientHttp.patch<UniteTransformation>(`/unites-transformation/${id}`, donnees),
};
