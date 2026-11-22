import { useOptionsReference } from '../../../../hooks/useOptionsReference';
import { useRequete } from '../../../../hooks/useRequete';
import { possedePermission } from '../../../authentification/utils/permissions';
import type { Profil } from '../../../profil/types/profilTypes';
import { produitService } from '../../../produits/services/produitService';
import { campagneAgricoleService } from '../../campagnes-agricoles/services/campagneAgricoleService';
import { siteProductionService } from '../../sites-production/services/siteProductionService';
import { tableauDeBordProductionService } from '../services/tableauDeBordProductionService';
import type { FiltresTableauProduction } from '../types/tableauDeBordProductionTypes';

/** Indicateurs du tableau de bord de production pour les filtres choisis. */
export function useTableauDeBordProduction(filtres: FiltresTableauProduction) {
  return useRequete((signal) => tableauDeBordProductionService.consulter(filtres, signal), [filtres.campagne_id, filtres.site_id]);
}

/** Campagnes, sites et produits pour les filtres et les libellés, selon les droits de consultation. */
export function useOptionsTableauProduction(profil: Profil | null) {
  const campagnes = useOptionsReference(
    possedePermission(profil, 'campagnes_agricoles')
      ? async (signal) =>
          (await campagneAgricoleService.lister({ taille_page: 100 }, signal)).items.map((campagne) => ({
            valeur: campagne._id,
            libelle: `${campagne.nom} (${campagne.code})`,
          }))
      : null,
    [profil?._id],
  );
  const sites = useOptionsReference(
    possedePermission(profil, 'sites_production')
      ? async (signal) =>
          (await siteProductionService.lister({ taille_page: 100 }, signal)).items.map((site) => ({ valeur: site._id, libelle: site.nom }))
      : null,
    [profil?._id],
  );
  const produits = useOptionsReference(
    possedePermission(profil, 'produits')
      ? async (signal) =>
          (await produitService.lister({ activite: 'production', taille_page: 100 }, signal)).items.map((produit) => ({
            valeur: produit._id,
            libelle: produit.nom,
          }))
      : null,
    [profil?._id],
  );
  return { campagnes, sites, produits };
}
