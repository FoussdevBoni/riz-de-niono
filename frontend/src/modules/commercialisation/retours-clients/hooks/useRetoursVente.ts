import { useListeReference } from '../../../../hooks/useOptionsReference';
import { possedePermission } from '../../../authentification/utils/permissions';
import type { Profil } from '../../../profil/types/profilTypes';
import { retourClientService } from '../services/retourClientService';
import type { RetourClient } from '../types/retourClientTypes';

/** Retours d'une vente (filtre vente_id), relus quand version change ; vide sans droit de consultation. */
export function useRetoursVente(profil: Profil | null, venteId: string, version?: string): RetourClient[] {
  return useListeReference(
    possedePermission(profil, 'retours_clients')
      ? async (signal) => (await retourClientService.lister({ vente_id: venteId, taille_page: 100 }, signal)).items
      : null,
    [profil?._id, venteId, version],
  );
}
