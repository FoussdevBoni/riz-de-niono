import { clientHttp, type PageResultats, type ParametresRequete } from '../../../api/clientHttp';
import type { Depense, DonneesDepense } from '../types/depenseTypes';

/**
 * Service du module depenses : endpoints /api/v1/depenses (document 04), partagé par les trois activités,
 * dont la validation, l'annulation avec motif et le justificatif (octets bruts en PUT, retrait en DELETE).
 */
export const depenseService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) => clientHttp.get<PageResultats<Depense>>('/depenses', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<Depense>(`/depenses/${id}`, undefined, signal),
  creer: (donnees: DonneesDepense) => clientHttp.post<Depense>('/depenses', donnees),
  modifier: (id: string, donnees: DonneesDepense) => clientHttp.patch<Depense>(`/depenses/${id}`, donnees),
  valider: (id: string) => clientHttp.post<Depense>(`/depenses/${id}/validation`),
  annuler: (id: string, motif: string) => clientHttp.post<Depense>(`/depenses/${id}/annulation`, { motif }),
  /** Corps : octets du fichier ; Content-Type : son type ; X-Nom-Fichier : son nom (encodé). Remplace l'ancien. */
  joindreJustificatif: (id: string, fichier: File) => clientHttp.envoyerFichier<Depense>(`/depenses/${id}/justificatif`, fichier),
  retirerJustificatif: (id: string) => clientHttp.supprimer<Depense>(`/depenses/${id}/justificatif`),
};
