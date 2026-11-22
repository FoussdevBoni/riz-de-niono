import type { Activite } from '../../profil/types/profilTypes';

/** Fiche renvoyée par /produits (document 04). */
export interface Produit {
  _id: string;
  code: string;
  nom: string;
  categorie_id: string;
  unite_stock: string;
  activites: Activite[];
  stockable: boolean;
  prix_vente: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface DonneesProduit {
  code?: string;
  nom?: string;
  categorie_id?: string;
  unite_stock?: string;
  activites?: Activite[];
  stockable?: boolean;
  prix_vente?: string | null;
  actif?: boolean;
}
