import { clientHttp, type PageResultats, type ParametresRequete } from '../../../../api/clientHttp';
import type { Culture, DonneesCulture } from '../types/cultureTypes';

/**
 * Service du module production/cultures : endpoints /api/v1/cultures (document 04).
 * Seul ce service appelle le client HTTP pour ce module ; pages, composants et hooks passent par lui.
 */
export const cultureService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<Culture>>('/cultures', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<Culture>(`/cultures/${id}`, undefined, signal),
  creer: (donnees: DonneesCulture) => clientHttp.post<Culture>('/cultures', donnees),
  modifier: (id: string, donnees: DonneesCulture) => clientHttp.patch<Culture>(`/cultures/${id}`, donnees),
};
