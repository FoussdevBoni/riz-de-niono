import { useListeReference } from '../../../../hooks/useOptionsReference';
import { possedePermission } from '../../../authentification/utils/permissions';
import type { Profil } from '../../../profil/types/profilTypes';
import { operationAgricoleService } from '../services/operationAgricoleService';
import type { OperationAgricole } from '../types/operationAgricoleTypes';

/**
 * Travaux d'une équipe visibles par l'utilisateur. L'API ne filtre pas par équipe : on lit les 100 derniers
 * travaux du périmètre et on garde ceux de l'équipe (suffisant pour le MVP).
 */
export function useTravauxEquipe(profil: Profil | null, equipeId: string): OperationAgricole[] {
  return useListeReference(
    possedePermission(profil, 'operations_agricoles')
      ? async (signal) =>
          (await operationAgricoleService.lister({ taille_page: 100 }, signal)).items.filter((operation) => operation.equipe_id === equipeId)
      : null,
    [profil?._id, equipeId],
  );
}
