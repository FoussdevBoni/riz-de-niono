import { Types } from 'mongoose';

import { decimal, versObjectIds } from '../../../../database/decimalMongo.js';
import {
  authentificationService,
  type ContexteSession,
} from '../../../authentification/services/authentificationService.js';
import { totaliserDepensesValidees } from '../../../depenses/services/depenseService.js';
import { produitService } from '../../../produits/services/produitService.js';
import { cultureService } from '../../cultures/services/cultureService.js';
import { compterTravaux } from '../../operations-agricoles/services/operationAgricoleService.js';
import { agregerRecoltesValidees } from '../../productions/services/productionService.js';

interface Recolte {
  produit_id: string;
  unite_stock: string | null;
  quantite: string;
  superficie_recoltee_ha: string;
  /** Quantité / superficie récoltée ; null si la superficie vaut zéro (rendement indisponible). */
  rendement_kg_ha: string | null;
}

export interface IndicateursProduction {
  superficie_cultivee_ha: string;
  superficie_recoltee_ha: string;
  recoltes: Recolte[];
  travaux: { realises: number; planifies: number };
  depenses_enregistrees: string;
}

export interface TableauDeBordProduction extends IndicateursProduction {
  filtres: { campagne_id: string | null; site_id: string | null };
  par_site: (IndicateursProduction & { site_id: string })[];
}

/** Somme des récoltes d'un ensemble de lignes (site × produit), regroupées par produit. */
function recoltesParProduit(
  lignes: { produit_id: string; superficie_ha: string; quantite: string }[],
  unites: Map<string, string>,
): Recolte[] {
  const parProduit = new Map<string, { quantite: string; superficie: string }>();
  for (const ligne of lignes) {
    const cumul = parProduit.get(ligne.produit_id) ?? { quantite: '0', superficie: '0' };
    parProduit.set(ligne.produit_id, {
      quantite: decimal.additionner(cumul.quantite, ligne.quantite),
      superficie: decimal.additionner(cumul.superficie, ligne.superficie_ha),
    });
  }
  return [...parProduit.entries()].map(([produitId, cumul]) => ({
    produit_id: produitId,
    unite_stock: unites.get(produitId) ?? null,
    quantite: cumul.quantite,
    superficie_recoltee_ha: cumul.superficie,
    rendement_kg_ha: decimal.diviser(cumul.quantite, cumul.superficie, 2),
  }));
}

/**
 * Service du tableau de bord de production. Il ne lit aucune collection lui-même : il agrège ce que
 * renvoient les services Cultures, Productions (récoltes validées), Opérations agricoles et Dépenses
 * (dépenses validées, affichées sous le nom « Dépenses enregistrées »), dans le périmètre de sites de l'utilisateur.
 */
export const tableauDeBordProductionService = {
  async consulter(contexte: ContexteSession, filtres: { campagne_id?: string; site_id?: string }): Promise<TableauDeBordProduction> {
    const filtre: Record<string, unknown> = {};
    if (filtres.campagne_id) filtre.campagne_id = new Types.ObjectId(filtres.campagne_id);
    if (filtres.site_id) {
      authentificationService.exigerSite(contexte, filtres.site_id);
      filtre.site_id = new Types.ObjectId(filtres.site_id);
    } else if (authentificationService.estLimiteAuxSites(contexte)) {
      filtre.site_id = { $in: versObjectIds(contexte.site_ids) };
    }

    const [superficies, recoltes, travaux, depenses] = await Promise.all([
      cultureService.agregerSuperficies(filtre),
      agregerRecoltesValidees(filtre),
      compterTravaux(filtre),
      totaliserDepensesValidees({ ...filtre, activite: 'production' }),
    ]);
    const unites = await produitService.lireUnites([...new Set(recoltes.map((recolte) => recolte.produit_id))]);

    const indicateurs = (siteId?: string): IndicateursProduction => {
      const garder = <T extends { site_id: string | null }>(lignes: T[]) => (siteId ? lignes.filter((ligne) => ligne.site_id === siteId) : lignes);
      const recoltesRetenues = garder(recoltes);
      const travauxRetenus = garder(travaux);
      return {
        superficie_cultivee_ha: decimal.additionner('0', ...garder(superficies).map((ligne) => ligne.superficie_ha)),
        superficie_recoltee_ha: decimal.additionner('0', ...recoltesRetenues.map((ligne) => ligne.superficie_ha)),
        recoltes: recoltesParProduit(recoltesRetenues, unites),
        travaux: {
          realises: travauxRetenus.reduce((total, ligne) => total + ligne.realises, 0),
          planifies: travauxRetenus.reduce((total, ligne) => total + ligne.planifies, 0),
        },
        depenses_enregistrees: decimal.additionner('0', ...garder(depenses).map((ligne) => ligne.montant)),
      };
    };

    const sites = [...new Set([...superficies, ...recoltes, ...travaux, ...depenses].flatMap((ligne) => (ligne.site_id ? [ligne.site_id] : [])))];
    return {
      filtres: { campagne_id: filtres.campagne_id ?? null, site_id: filtres.site_id ?? null },
      ...indicateurs(),
      par_site: sites.sort().map((siteId) => ({ site_id: siteId, ...indicateurs(siteId) })),
    };
  },
};
