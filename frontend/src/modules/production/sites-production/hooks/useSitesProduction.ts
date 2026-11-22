import { useListeReference } from '../../../../hooks/useOptionsReference';
import { possedePermission } from '../../../authentification/utils/permissions';
import type { Profil } from '../../../profil/types/profilTypes';
import { siteProductionService } from '../services/siteProductionService';
import type { SiteProduction } from '../types/siteProductionTypes';

/** Sites visibles par l'utilisateur (périmètre appliqué par l'API), pour les choix et les libellés. */
export function useSitesReference(profil: Profil | null): SiteProduction[] {
  return useListeReference(
    possedePermission(profil, 'sites_production')
      ? async (signal) => (await siteProductionService.lister({ taille_page: 100 }, signal)).items
      : null,
    [profil?._id],
  );
}

export function optionsSites(sites: SiteProduction[]) {
  return sites.map((site) => ({ valeur: site._id, libelle: site.actif ? site.nom : `${site.nom} (archivé)` }));
}

/** Vrai si l'utilisateur couvre tous les sites donnés (site_ids vide : tous les sites). */
export function couvreSites(profil: Profil | null, siteIds: string[]): boolean {
  if (!profil) return false;
  if (profil.site_ids.length === 0) return true;
  return siteIds.every((id) => profil.site_ids.includes(id));
}
