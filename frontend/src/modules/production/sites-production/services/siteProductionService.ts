import { clientHttp, type PageResultats, type ParametresRequete } from '../../../../api/clientHttp';
import type { DonneesSiteProduction, SiteProduction } from '../types/siteProductionTypes';

/**
 * Service du module production/sites-production : endpoints /api/v1/sites-production (document 04).
 * Seul ce service appelle le client HTTP pour ce module ; pages, composants et hooks passent par lui.
 */
export const siteProductionService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<SiteProduction>>('/sites-production', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<SiteProduction>(`/sites-production/${id}`, undefined, signal),
  /** Code interne proposé à partir du nom (unicité garantie à la création). */
  proposerCode: (nom: string, signal?: AbortSignal) =>
    clientHttp.get<{ code: string }>('/sites-production/code-propose', { nom }, signal),
  creer: (donnees: DonneesSiteProduction) => clientHttp.post<SiteProduction>('/sites-production', donnees),
  modifier: (id: string, donnees: DonneesSiteProduction) => clientHttp.patch<SiteProduction>(`/sites-production/${id}`, donnees),
};
