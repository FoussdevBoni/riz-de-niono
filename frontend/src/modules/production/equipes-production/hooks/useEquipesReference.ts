import { useListeReference } from '../../../../hooks/useOptionsReference';
import { possedePermission } from '../../../authentification/utils/permissions';
import type { Profil } from '../../../profil/types/profilTypes';
import { equipeProductionService } from '../services/equipeProductionService';
import type { EquipeProduction } from '../types/equipeProductionTypes';

/** Équipes pour les formulaires et les libellés (vide sans droit de consultation). */
export function useEquipesReference(profil: Profil | null): EquipeProduction[] {
  return useListeReference(
    possedePermission(profil, 'equipes_production')
      ? async (signal) => (await equipeProductionService.lister({ taille_page: 100 }, signal)).items
      : null,
    [profil?._id],
  );
}
