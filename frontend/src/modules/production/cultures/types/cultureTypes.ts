/** Culture renvoyée par /cultures (document 04). */
export interface Culture {
  _id: string;
  campagne_id: string;
  site_id: string;
  culture: string;
  variete: string | null;
  superficie_ha: string;
  date_semis: string | null;
  created_at: string;
  updated_at: string;
}

export interface DonneesCulture {
  campagne_id?: string;
  site_id?: string;
  culture?: string;
  variete?: string | null;
  superficie_ha?: string;
  date_semis?: string | null;
}
