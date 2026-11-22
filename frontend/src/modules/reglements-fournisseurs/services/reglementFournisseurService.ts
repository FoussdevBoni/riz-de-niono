import { clientHttp, type PageResultats, type ParametresRequete } from '../../../api/clientHttp';
import type { DonneesReglementFournisseur, FicheReglementFournisseur, ReglementFournisseur } from '../types/reglementFournisseurTypes';

/**
 * Service du module reglements-fournisseurs : endpoints /api/v1/reglements-fournisseurs (document 04),
 * partagé par les trois activités, dont la validation et l'annulation avec motif.
 */
export const reglementFournisseurService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<ReglementFournisseur>>('/reglements-fournisseurs', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) =>
    clientHttp.get<FicheReglementFournisseur>(`/reglements-fournisseurs/${id}`, undefined, signal),
  creer: (donnees: DonneesReglementFournisseur) => clientHttp.post<ReglementFournisseur>('/reglements-fournisseurs', donnees),
  modifier: (id: string, donnees: DonneesReglementFournisseur) =>
    clientHttp.patch<ReglementFournisseur>(`/reglements-fournisseurs/${id}`, donnees),
  valider: (id: string) => clientHttp.post<ReglementFournisseur>(`/reglements-fournisseurs/${id}/validation`),
  annuler: (id: string, motif: string) => clientHttp.post<ReglementFournisseur>(`/reglements-fournisseurs/${id}/annulation`, { motif }),
};
