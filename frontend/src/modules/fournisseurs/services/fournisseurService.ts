import { clientHttp, type PageResultats, type ParametresRequete } from '../../../api/clientHttp';
import type { DonneesFournisseur, Fournisseur } from '../types/fournisseurTypes';

/**
 * Service du module fournisseurs : endpoints /api/v1/fournisseurs (document 04), partagé par les trois activités.
 * Seul ce service appelle le client HTTP pour ce module ; pages, composants et hooks passent par lui.
 */
export const fournisseurService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<Fournisseur>>('/fournisseurs', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<Fournisseur>(`/fournisseurs/${id}`, undefined, signal),
  creer: (donnees: DonneesFournisseur) => clientHttp.post<Fournisseur>('/fournisseurs', donnees),
  modifier: (id: string, donnees: DonneesFournisseur) => clientHttp.patch<Fournisseur>(`/fournisseurs/${id}`, donnees),
};
