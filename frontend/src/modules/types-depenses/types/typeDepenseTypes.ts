/** Fiche renvoyée par /types-depenses (document 04). */
export interface TypeDepense {
  _id: string;
  code: string;
  nom: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface DonneesTypeDepense {
  code?: string;
  nom?: string;
  actif?: boolean;
}

/** Type de référence : ni recodage ni archivage (409 type_reference, document 04). */
export const CODE_ENTRETIEN_MATERIEL = 'ENTRETIEN-MATERIEL';
