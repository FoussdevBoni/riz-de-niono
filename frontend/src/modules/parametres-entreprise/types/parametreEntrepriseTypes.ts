export interface CoordonneesEntreprise {
  adresse: string | null;
  telephone: string | null;
  email: string | null;
}

/** Paramètres renvoyés par /parametres-entreprise (document 04). */
export interface ParametresEntreprise {
  _id: string;
  nom: string;
  coordonnees: CoordonneesEntreprise;
  /** Code ISO 4217 de trois lettres, par exemple XOF. */
  devise: string;
  updated_at: string;
}

/** Les coordonnées transmises sont fusionnées avec les existantes ; null efface un champ. */
export interface DonneesParametres {
  nom?: string;
  coordonnees?: Partial<CoordonneesEntreprise>;
  devise?: string;
}
