import { useListeReference } from '../../../../hooks/useOptionsReference';
import { possedePermission } from '../../../authentification/utils/permissions';
import type { Profil } from '../../../profil/types/profilTypes';
import { encaissementService } from '../services/encaissementService';
import type { Encaissement } from '../types/encaissementTypes';

/** Encaissements d'une vente (filtre vente_id), relus quand version change ; vide sans droit de consultation. */
export function useEncaissementsVente(profil: Profil | null, venteId: string, version?: string): Encaissement[] {
  return useListeReference(
    possedePermission(profil, 'encaissements')
      ? async (signal) => (await encaissementService.lister({ vente_id: venteId, taille_page: 100 }, signal)).items
      : null,
    [profil?._id, venteId, version],
  );
}
