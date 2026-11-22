import { useListeReference } from '../../../../hooks/useOptionsReference';
import { possedePermission } from '../../../authentification/utils/permissions';
import type { Profil } from '../../../profil/types/profilTypes';
import { typeOperationAgricoleService } from '../services/typeOperationAgricoleService';
import type { TypeOperationAgricole } from '../types/typeOperationAgricoleTypes';

/** Types d'opérations pour les formulaires, filtres et libellés (vide sans droit de consultation). */
export function useTypesOperationsReference(profil: Profil | null): TypeOperationAgricole[] {
  return useListeReference(
    possedePermission(profil, 'types_operations_agricoles')
      ? async (signal) => (await typeOperationAgricoleService.lister({ taille_page: 100 }, signal)).items
      : null,
    [profil?._id],
  );
}
