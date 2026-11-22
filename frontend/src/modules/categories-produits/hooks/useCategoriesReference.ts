import { useListeReference } from '../../../hooks/useOptionsReference';
import { possedePermission } from '../../authentification/utils/permissions';
import type { Profil } from '../../profil/types/profilTypes';
import { categorieProduitService } from '../services/categorieProduitService';
import type { CategorieProduit } from '../types/categorieProduitTypes';

/** Catégories pour les filtres, le formulaire produit et les libellés (vide sans droit de consultation). */
export function useCategoriesReference(profil: Profil | null): CategorieProduit[] {
  return useListeReference(
    possedePermission(profil, 'categories_produits')
      ? async (signal) => (await categorieProduitService.lister({ taille_page: 100 }, signal)).items
      : null,
    [profil?._id],
  );
}

export function optionsCategories(categories: CategorieProduit[]) {
  return categories.map((categorie) => ({ valeur: categorie._id, libelle: categorie.actif ? categorie.nom : `${categorie.nom} (archivée)` }));
}
