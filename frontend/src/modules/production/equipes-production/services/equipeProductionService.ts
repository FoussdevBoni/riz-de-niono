import { clientHttp, type PageResultats, type ParametresRequete } from '../../../../api/clientHttp';
import type { DonneesEquipeProduction, EquipeProduction } from '../types/equipeProductionTypes';

/**
 * Service du module production/equipes-production : endpoints /api/v1/equipes-production (document 04).
 * Seul ce service appelle le client HTTP pour ce module ; pages, composants et hooks passent par lui.
 */
export const equipeProductionService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<EquipeProduction>>('/equipes-production', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<EquipeProduction>(`/equipes-production/${id}`, undefined, signal),
  creer: (donnees: DonneesEquipeProduction) => clientHttp.post<EquipeProduction>('/equipes-production', donnees),
  modifier: (id: string, donnees: DonneesEquipeProduction) => clientHttp.patch<EquipeProduction>(`/equipes-production/${id}`, donnees),
};
