import { useListeReference } from '../../../../hooks/useOptionsReference';
import { possedeActivite, possedePermission } from '../../../authentification/utils/permissions';
import type { Profil } from '../../../profil/types/profilTypes';
import { uniteTransformationService } from '../services/uniteTransformationService';
import type { UniteTransformation } from '../types/uniteTransformationTypes';

/** Unités de transformation pour les rattachements et libellés (activité transformation et consultation requises). */
export function useUnitesReference(profil: Profil | null): UniteTransformation[] {
  return useListeReference(
    possedeActivite(profil, 'transformation') && possedePermission(profil, 'unites_transformation')
      ? async (signal) => (await uniteTransformationService.lister({ taille_page: 100 }, signal)).items
      : null,
    [profil?._id],
  );
}
