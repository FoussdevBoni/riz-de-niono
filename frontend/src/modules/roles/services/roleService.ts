import { clientHttp, type PageResultats, type ParametresRequete } from '../../../api/clientHttp';
import type { DonneesRole, Role } from '../types/roleTypes';

/**
 * Service du module roles : endpoints /api/v1/roles (document 04).
 * Lecture : roles + consultation ; création, modification et archivage : roles + administration.
 */
export const roleService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) => clientHttp.get<PageResultats<Role>>('/roles', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<Role>(`/roles/${id}`, undefined, signal),
  creer: (donnees: DonneesRole) => clientHttp.post<Role>('/roles', donnees),
  modifier: (id: string, donnees: DonneesRole) => clientHttp.patch<Role>(`/roles/${id}`, donnees),
};
