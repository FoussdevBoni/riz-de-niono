import { clientHttp, type PageResultats, type ParametresRequete } from '../../../api/clientHttp';
import type { DonneesTypeDepense, TypeDepense } from '../types/typeDepenseTypes';

/**
 * Service du module types-depenses : endpoints /api/v1/types-depenses (document 04), partagé par les trois activités.
 * Seul ce service appelle le client HTTP pour ce module ; pages, composants et hooks passent par lui.
 */
export const typeDepenseService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<TypeDepense>>('/types-depenses', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<TypeDepense>(`/types-depenses/${id}`, undefined, signal),
  /** Code interne proposé à partir du nom (unicité garantie à la création). */
  proposerCode: (nom: string, signal?: AbortSignal) =>
    clientHttp.get<{ code: string }>('/types-depenses/code-propose', { nom }, signal),
  creer: (donnees: DonneesTypeDepense) => clientHttp.post<TypeDepense>('/types-depenses', donnees),
  modifier: (id: string, donnees: DonneesTypeDepense) => clientHttp.patch<TypeDepense>(`/types-depenses/${id}`, donnees),
};
