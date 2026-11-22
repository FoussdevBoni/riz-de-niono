import { clientHttp, type PageResultats, type ParametresRequete } from '../../../../api/clientHttp';
import type { DonneesTypeOperationAgricole, TypeOperationAgricole } from '../types/typeOperationAgricoleTypes';

/**
 * Service du module production/types-operations-agricoles : endpoints /api/v1/types-operations-agricoles (document 04).
 * Seul ce service appelle le client HTTP pour ce module ; pages, composants et hooks passent par lui.
 */
export const typeOperationAgricoleService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<TypeOperationAgricole>>('/types-operations-agricoles', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) =>
    clientHttp.get<TypeOperationAgricole>(`/types-operations-agricoles/${id}`, undefined, signal),
  /** Code interne proposé à partir du nom (unicité garantie à la création). */
  proposerCode: (nom: string, signal?: AbortSignal) =>
    clientHttp.get<{ code: string }>('/types-operations-agricoles/code-propose', { nom }, signal),
  creer: (donnees: DonneesTypeOperationAgricole) => clientHttp.post<TypeOperationAgricole>('/types-operations-agricoles', donnees),
  modifier: (id: string, donnees: DonneesTypeOperationAgricole) =>
    clientHttp.patch<TypeOperationAgricole>(`/types-operations-agricoles/${id}`, donnees),
};
