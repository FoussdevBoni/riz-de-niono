import { useListeReference } from '../../../hooks/useOptionsReference';
import { possedePermission } from '../../authentification/utils/permissions';
import type { Activite, Profil } from '../../profil/types/profilTypes';
import { achatService } from '../services/achatService';
import type { Achat } from '../types/achatTypes';

/** Achats d'un fournisseur dans l'activité ouverte (filtres fournisseur_id et activite). */
export function useAchatsFournisseur(profil: Profil | null, activite: Activite, fournisseurId: string): Achat[] {
  return useListeReference(
    possedePermission(profil, 'achats')
      ? async (signal) => (await achatService.lister({ activite, fournisseur_id: fournisseurId, taille_page: 100 }, signal)).items
      : null,
    [profil?._id, activite, fournisseurId],
  );
}

/** Achats validés de l'activité, pour choisir l'achat d'un règlement (les plus récents d'abord). */
export function useAchatsReglables(profil: Profil | null, activite: Activite): Achat[] {
  return useListeReference(
    possedePermission(profil, 'achats')
      ? async (signal) => (await achatService.lister({ activite, statut: 'validee', taille_page: 100 }, signal)).items
      : null,
    [profil?._id, activite],
  );
}
