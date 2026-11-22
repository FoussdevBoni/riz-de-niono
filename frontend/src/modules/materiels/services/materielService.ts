import { clientHttp, type PageResultats, type ParametresRequete } from '../../../api/clientHttp';
import type { DonneesMateriel, Materiel } from '../types/materielTypes';

/**
 * Service du module materiels : endpoints /api/v1/materiels (document 04), partagé par les trois activités.
 * Seul ce service appelle le client HTTP pour ce module ; pages, composants et hooks passent par lui.
 */
export const materielService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) => clientHttp.get<PageResultats<Materiel>>('/materiels', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<Materiel>(`/materiels/${id}`, undefined, signal),
  /** Code interne proposé à partir du nom (unicité garantie à la création). */
  proposerCode: (nom: string, signal?: AbortSignal) =>
    clientHttp.get<{ code: string }>('/materiels/code-propose', { nom }, signal),
  creer: (donnees: DonneesMateriel) => clientHttp.post<Materiel>('/materiels', donnees),
  modifier: (id: string, donnees: DonneesMateriel) => clientHttp.patch<Materiel>(`/materiels/${id}`, donnees),
};
