import { useListeReference } from '../../../hooks/useOptionsReference';
import { possedePermission } from '../../authentification/utils/permissions';
import type { Profil } from '../../profil/types/profilTypes';
import { fournisseurService } from '../services/fournisseurService';
import type { Fournisseur } from '../types/fournisseurTypes';

/** Fournisseurs pour les filtres, le formulaire d'achat et les libellés (vide sans droit de consultation). */
export function useFournisseursReference(profil: Profil | null): Fournisseur[] {
  return useListeReference(
    possedePermission(profil, 'fournisseurs')
      ? async (signal) => (await fournisseurService.lister({ taille_page: 100 }, signal)).items
      : null,
    [profil?._id],
  );
}

export function optionsFournisseurs(fournisseurs: Fournisseur[]) {
  return fournisseurs.map((fournisseur) => ({ valeur: fournisseur._id, libelle: fournisseur.actif ? fournisseur.nom : `${fournisseur.nom} (archivé)` }));
}
