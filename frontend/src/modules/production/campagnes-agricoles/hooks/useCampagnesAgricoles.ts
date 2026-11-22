import { useListeReference } from '../../../../hooks/useOptionsReference';
import { possedePermission } from '../../../authentification/utils/permissions';
import type { Profil } from '../../../profil/types/profilTypes';
import { campagneAgricoleService } from '../services/campagneAgricoleService';
import type { CampagneAgricole } from '../types/campagneAgricoleTypes';

/** Campagnes visibles par l'utilisateur, pour les filtres, les formulaires et les libellés. */
export function useCampagnesReference(profil: Profil | null): CampagneAgricole[] {
  return useListeReference(
    possedePermission(profil, 'campagnes_agricoles')
      ? async (signal) => (await campagneAgricoleService.lister({ taille_page: 100 }, signal)).items
      : null,
    [profil?._id],
  );
}

export function optionsCampagnes(campagnes: CampagneAgricole[]) {
  return campagnes.map((campagne) => ({ valeur: campagne._id, libelle: `${campagne.nom} (${campagne.code})` }));
}
