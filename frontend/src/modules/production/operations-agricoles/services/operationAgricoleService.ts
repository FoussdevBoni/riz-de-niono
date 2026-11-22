import { clientHttp, type PageResultats, type ParametresRequete } from '../../../../api/clientHttp';
import type { DonneesOperationAgricole, OperationAgricole } from '../types/operationAgricoleTypes';

/**
 * Service du module production/operations-agricoles : endpoints /api/v1/operations-agricoles (document 04),
 * dont la validation (sortie des intrants du stock) et l'annulation avec motif.
 */
export const operationAgricoleService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<OperationAgricole>>('/operations-agricoles', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<OperationAgricole>(`/operations-agricoles/${id}`, undefined, signal),
  creer: (donnees: DonneesOperationAgricole) => clientHttp.post<OperationAgricole>('/operations-agricoles', donnees),
  modifier: (id: string, donnees: DonneesOperationAgricole) => clientHttp.patch<OperationAgricole>(`/operations-agricoles/${id}`, donnees),
  valider: (id: string) => clientHttp.post<OperationAgricole>(`/operations-agricoles/${id}/validation`),
  annuler: (id: string, motif: string) => clientHttp.post<OperationAgricole>(`/operations-agricoles/${id}/annulation`, { motif }),
};
