export interface SituationVentes {
  montant_total: string;
  montant_encaisse: string;
  montant_retours: string;
  solde: string;
  trop_percu: string;
}

/** Réponse de GET /tableaux-de-bord/commercialisation (document 04). */
export interface TableauDeBordCommercialisation {
  filtres: { date_debut: string | null; date_fin: string | null; client_id: string | null; produit_id: string | null };
  ventes_validees: { nombre: number; montant_total: string };
  quantites_vendues: { produit_id: string; produit_nom?: string | null; unite_stock: string | null; quantite: string; quantite_retournee: string; montant: string }[];
  commandes_livrees: { nombre: number; montant_total: string };
  encaissements: string;
  soldes: SituationVentes;
  depenses_enregistrees: string;
}

export interface FiltresTableauCommercialisation {
  date_debut?: string;
  date_fin?: string;
  client_id?: string;
  produit_id?: string;
}
