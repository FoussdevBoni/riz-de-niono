import { useListeReference } from '../../../hooks/useOptionsReference';
import { possedePermission } from '../../authentification/utils/permissions';
import type { Profil } from '../../profil/types/profilTypes';
import { utilisateurService } from '../services/utilisateurService';
import type { UtilisateurResume } from '../types/utilisateurTypes';

/**
 * Utilisateurs visibles, pour choisir ou afficher un responsable. Sans consultation du module
 * utilisateurs, la liste reste vide et la page affiche l'identifiant abrégé.
 */
export function useUtilisateursReference(profil: Profil | null): UtilisateurResume[] {
  return useListeReference(
    possedePermission(profil, 'utilisateurs')
      ? async (signal) => (await utilisateurService.lister({ taille_page: 100 }, signal)).items
      : null,
    [profil?._id],
  );
}
