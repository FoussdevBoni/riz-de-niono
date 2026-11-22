export interface RecolteProduit {
  produit_id: string;
  produit_nom?: string | null;
  unite_stock: string | null;
  quantite: string;
  superficie_recoltee_ha: string;
  /** null : superficie récoltée nulle, rendement indisponible. */
  rendement_kg_ha: string | null;
}

export interface IndicateursProduction {
  superficie_cultivee_ha: string;
  superficie_recoltee_ha: string;
  recoltes: RecolteProduit[];
  travaux: { realises: number; planifies: number };
  depenses_enregistrees: string;
}

/** Réponse de GET /tableaux-de-bord/production (document 04). */
export interface TableauDeBordProduction extends IndicateursProduction {
  filtres: { campagne_id: string | null; site_id: string | null };
  par_site: (IndicateursProduction & { site_id: string })[];
}

export interface FiltresTableauProduction {
  campagne_id?: string;
  site_id?: string;
}
