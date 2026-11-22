import { useListeReference } from '../../../hooks/useOptionsReference';
import { possedePermission } from '../../authentification/utils/permissions';
import type { Profil } from '../../profil/types/profilTypes';
import { typeDepenseService } from '../services/typeDepenseService';
import type { TypeDepense } from '../types/typeDepenseTypes';

/** Types de dépenses pour les formulaires, filtres et libellés (vide sans droit de consultation). */
export function useTypesDepensesReference(profil: Profil | null): TypeDepense[] {
  return useListeReference(
    possedePermission(profil, 'types_depenses') ? async (signal) => (await typeDepenseService.lister({ taille_page: 100 }, signal)).items : null,
    [profil?._id],
  );
}
