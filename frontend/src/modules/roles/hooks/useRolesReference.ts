import { useListeReference } from '../../../hooks/useOptionsReference';
import { possedePermission } from '../../authentification/utils/permissions';
import type { Profil } from '../../profil/types/profilTypes';
import { roleService } from '../services/roleService';
import type { Role } from '../types/roleTypes';

/** Rôles pour le formulaire utilisateur, les filtres et les libellés (vide sans droit de consultation). */
export function useRolesReference(profil: Profil | null): Role[] {
  return useListeReference(
    possedePermission(profil, 'roles') ? async (signal) => (await roleService.lister({ taille_page: 100 }, signal)).items : null,
    [profil?._id],
  );
}
