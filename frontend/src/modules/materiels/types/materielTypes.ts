import type { Activite } from '../../profil/types/profilTypes';

/** Fiche renvoyée par /materiels (document 04) ; visible si l'une de ses activités appartient au périmètre. */
export interface Materiel {
  _id: string;
  code: string;
  nom: string;
  activites: Activite[];
  quantite_totale: string;
  /** Comprise entre zéro et la quantité totale (422 sinon). */
  quantite_disponible: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface DonneesMateriel {
  code?: string;
  nom?: string;
  activites?: Activite[];
  quantite_totale?: string;
  quantite_disponible?: string;
  actif?: boolean;
}
