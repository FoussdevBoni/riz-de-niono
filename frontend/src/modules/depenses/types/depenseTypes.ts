import type { StatutOperation } from '../../production/productions/types/productionTypes';
import type { Activite } from '../../profil/types/profilTypes';

export interface Justificatif {
  url_securisee: string;
  type_ressource: 'image' | 'raw';
  format: string | null;
  octets: number;
  nom_fichier: string | null;
  ajoute_at: string;
  ajoute_par_id: string | null;
}

/** Dépense renvoyée par /depenses (document 04). En production, site et campagne sont obligatoires. */
export interface Depense {
  _id: string;
  activite: Activite;
  type_depense_id: string;
  date_depense: string;
  montant: string;
  libelle: string;
  site_id: string | null;
  campagne_id: string | null;
  unite_transformation_id: string | null;
  materiel_id: string | null;
  justificatif: Justificatif | null;
  statut: StatutOperation;
  validated_at: string | null;
  validated_by_id: string | null;
  motif_annulation: string | null;
  annulee_at: string | null;
  annulee_par_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DonneesDepense {
  activite?: Activite;
  type_depense_id?: string;
  date_depense?: string;
  montant?: string;
  libelle?: string;
  site_id?: string | null;
  campagne_id?: string | null;
  unite_transformation_id?: string | null;
  materiel_id?: string | null;
}

/** Fichiers acceptés pour un justificatif et taille maximale (document 04). */
export const TYPES_JUSTIFICATIF = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const TAILLE_MAX_JUSTIFICATIF = 10 * 1024 * 1024;
