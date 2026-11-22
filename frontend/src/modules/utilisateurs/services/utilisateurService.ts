import { clientHttp, type PageResultats, type ParametresRequete } from '../../../api/clientHttp';
import type { DonneesUtilisateur, UtilisateurResume } from '../types/utilisateurTypes';

/**
 * Service du module utilisateurs : endpoints /api/v1/utilisateurs (document 04).
 * Lecture : utilisateurs + consultation ; création et modification : utilisateurs + administration.
 */
export const utilisateurService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<UtilisateurResume>>('/utilisateurs', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<UtilisateurResume>(`/utilisateurs/${id}`, undefined, signal),
  creer: (donnees: DonneesUtilisateur) => clientHttp.post<UtilisateurResume>('/utilisateurs', donnees),
  modifier: (id: string, donnees: DonneesUtilisateur) => clientHttp.patch<UtilisateurResume>(`/utilisateurs/${id}`, donnees),
};
