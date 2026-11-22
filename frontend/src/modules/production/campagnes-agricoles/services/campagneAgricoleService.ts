import { clientHttp, type PageResultats, type ParametresRequete } from '../../../../api/clientHttp';
import type { CampagneAgricole, DonneesCampagneAgricole } from '../types/campagneAgricoleTypes';

/**
 * Service du module production/campagnes-agricoles : endpoints /api/v1/campagnes-agricoles (document 04),
 * dont l'ouverture et la clôture.
 */
export const campagneAgricoleService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<CampagneAgricole>>('/campagnes-agricoles', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<CampagneAgricole>(`/campagnes-agricoles/${id}`, undefined, signal),
  /** Code interne proposé à partir du nom (unicité garantie à la création). */
  proposerCode: (nom: string, signal?: AbortSignal) =>
    clientHttp.get<{ code: string }>('/campagnes-agricoles/code-propose', { nom }, signal),
  creer: (donnees: DonneesCampagneAgricole) => clientHttp.post<CampagneAgricole>('/campagnes-agricoles', donnees),
  modifier: (id: string, donnees: DonneesCampagneAgricole) => clientHttp.patch<CampagneAgricole>(`/campagnes-agricoles/${id}`, donnees),
  supprimer: (id: string) => clientHttp.supprimer<void>(`/campagnes-agricoles/${id}`),
  ouvrir: (id: string) => clientHttp.post<CampagneAgricole>(`/campagnes-agricoles/${id}/ouverture`),
  cloturer: (id: string) => clientHttp.post<CampagneAgricole>(`/campagnes-agricoles/${id}/cloture`),
};
