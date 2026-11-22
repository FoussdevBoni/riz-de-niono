import { useListeReference } from '../../../hooks/useOptionsReference';
import { possedePermission } from '../../authentification/utils/permissions';
import type { Activite, Profil } from '../../profil/types/profilTypes';
import { materielService } from '../services/materielService';
import type { Materiel } from '../types/materielTypes';

/** Matériel d'une activité pour les formulaires de dépense et les libellés (vide sans droit de consultation). */
export function useMaterielsReference(profil: Profil | null, activite?: Activite): Materiel[] {
  return useListeReference(
    possedePermission(profil, 'materiels') ? async (signal) => (await materielService.lister({ activite, taille_page: 100 }, signal)).items : null,
    [profil?._id, activite],
  );
}
