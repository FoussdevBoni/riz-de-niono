import { useListeReference } from '../../../hooks/useOptionsReference';
import { possedePermission } from '../../authentification/utils/permissions';
import type { Activite, Profil } from '../../profil/types/profilTypes';
import { produitService } from '../services/produitService';
import type { Produit } from '../types/produitTypes';

/** Produits visibles (éventuellement d'une activité), pour les choix, les libellés et les unités. */
export function useProduitsReference(profil: Profil | null, activite?: Activite): Produit[] {
  return useListeReference(
    possedePermission(profil, 'produits')
      ? async (signal) => (await produitService.lister({ activite, taille_page: 100 }, signal)).items
      : null,
    [profil?._id, activite],
  );
}

export function optionsProduits(produits: Produit[]) {
  return produits.map((produit) => ({ valeur: produit._id, libelle: produit.nom }));
}
