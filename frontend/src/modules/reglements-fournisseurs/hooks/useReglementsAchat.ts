import { useListeReference } from '../../../hooks/useOptionsReference';
import { possedePermission } from '../../authentification/utils/permissions';
import type { Profil } from '../../profil/types/profilTypes';
import { reglementFournisseurService } from '../services/reglementFournisseurService';
import type { ReglementFournisseur } from '../types/reglementFournisseurTypes';

/** Règlements d'un achat (filtre achat_id), relus quand version change ; vide sans droit de consultation. */
export function useReglementsAchat(profil: Profil | null, achatId: string, version?: string): ReglementFournisseur[] {
  return useListeReference(
    possedePermission(profil, 'reglements_fournisseurs')
      ? async (signal) => (await reglementFournisseurService.lister({ achat_id: achatId, taille_page: 100 }, signal)).items
      : null,
    [profil?._id, achatId, version],
  );
}
