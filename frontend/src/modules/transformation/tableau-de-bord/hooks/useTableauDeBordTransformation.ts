import { useOptionsReference } from '../../../../hooks/useOptionsReference';
import { useRequete } from '../../../../hooks/useRequete';
import { possedePermission } from '../../../authentification/utils/permissions';
import type { Profil } from '../../../profil/types/profilTypes';
import { produitService } from '../../../produits/services/produitService';
import { uniteTransformationService } from '../../unites-transformation/services/uniteTransformationService';
import { tableauDeBordTransformationService } from '../services/tableauDeBordTransformationService';
import type { FiltresTableauTransformation } from '../types/tableauDeBordTransformationTypes';

/** Indicateurs du tableau de bord de transformation pour l'unité et la période choisies. */
export function useTableauDeBordTransformation(filtres: FiltresTableauTransformation) {
  return useRequete(
    (signal) => tableauDeBordTransformationService.consulter(filtres, signal),
    [filtres.unite_transformation_id, filtres.date_debut, filtres.date_fin],
  );
}

/** Unités et produits pour les filtres et les libellés, selon les droits de consultation. */
export function useOptionsTableauTransformation(profil: Profil | null) {
  const unites = useOptionsReference(
    possedePermission(profil, 'unites_transformation')
      ? async (signal) =>
          (await uniteTransformationService.lister({ taille_page: 100 }, signal)).items.map((unite) => ({ valeur: unite._id, libelle: unite.nom }))
      : null,
    [profil?._id],
  );
  const produits = useOptionsReference(
    possedePermission(profil, 'produits')
      ? async (signal) =>
          (await produitService.lister({ activite: 'transformation', taille_page: 100 }, signal)).items.map((produit) => ({
            valeur: produit._id,
            libelle: produit.nom,
          }))
      : null,
    [profil?._id],
  );
  return { unites, produits };
}
