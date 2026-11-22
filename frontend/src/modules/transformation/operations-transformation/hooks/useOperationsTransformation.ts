import { useListeReference } from '../../../../hooks/useOptionsReference';
import { possedePermission } from '../../../authentification/utils/permissions';
import type { Profil } from '../../../profil/types/profilTypes';
import { operationTransformationService } from '../services/operationTransformationService';
import type { OperationTransformation } from '../types/operationTransformationTypes';

/** Dernières opérations d'une unité (filtre unite_transformation_id), vide sans droit de consultation. */
export function useOperationsUnite(profil: Profil | null, uniteId: string): OperationTransformation[] {
  return useListeReference(
    possedePermission(profil, 'operations_transformation')
      ? async (signal) => (await operationTransformationService.lister({ unite_transformation_id: uniteId, taille_page: 20 }, signal)).items
      : null,
    [profil?._id, uniteId],
  );
}
