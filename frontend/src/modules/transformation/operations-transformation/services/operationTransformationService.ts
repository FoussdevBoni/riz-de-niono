import { clientHttp, type PageResultats, type ParametresRequete } from '../../../../api/clientHttp';
import type { DonneesOperationTransformation, OperationTransformation } from '../types/operationTransformationTypes';

/**
 * Service du module transformation/operations-transformation : endpoints /api/v1/operations-transformation
 * (document 04), dont la validation (sortie du paddy, entrée des produits obtenus) et l'annulation avec motif.
 */
export const operationTransformationService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<OperationTransformation>>('/operations-transformation', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) =>
    clientHttp.get<OperationTransformation>(`/operations-transformation/${id}`, undefined, signal),
  creer: (donnees: DonneesOperationTransformation) => clientHttp.post<OperationTransformation>('/operations-transformation', donnees),
  modifier: (id: string, donnees: DonneesOperationTransformation) =>
    clientHttp.patch<OperationTransformation>(`/operations-transformation/${id}`, donnees),
  valider: (id: string) => clientHttp.post<OperationTransformation>(`/operations-transformation/${id}/validation`),
  annuler: (id: string, motif: string) =>
    clientHttp.post<OperationTransformation>(`/operations-transformation/${id}/annulation`, { motif }),
};
