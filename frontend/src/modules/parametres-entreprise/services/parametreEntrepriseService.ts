import { clientHttp } from '../../../api/clientHttp';
import type { DonneesParametres, ParametresEntreprise } from '../types/parametreEntrepriseTypes';

/**
 * Service du module parametres-entreprise : endpoint /api/v1/parametres-entreprise (document 04).
 * Consultation : parametres_entreprise + consultation ; modification : administration.
 */
export const parametreEntrepriseService = {
  consulter: (signal?: AbortSignal) => clientHttp.get<ParametresEntreprise>('/parametres-entreprise', undefined, signal),
  modifier: (donnees: DonneesParametres) => clientHttp.patch<ParametresEntreprise>('/parametres-entreprise', donnees),
};
