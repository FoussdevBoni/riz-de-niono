/** Fiche renvoyée par /fournisseurs (document 04), commune aux trois activités. */
export interface Fournisseur {
  _id: string;
  nom: string;
  telephone: string | null;
  adresse: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface DonneesFournisseur {
  nom?: string;
  telephone?: string | null;
  adresse?: string | null;
  actif?: boolean;
}
