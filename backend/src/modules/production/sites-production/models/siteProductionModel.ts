import { model, type Types } from 'mongoose';

import { siteProductionSchema } from '../schemas/siteProductionSchema.js';

export interface DocumentSiteProduction {
  _id: Types.ObjectId;
  code: string;
  nom: string;
  localisation: string | null;
  superficie_ha: Types.Decimal128 | null;
  responsable_id: Types.ObjectId | null;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export const SiteProductionModel = model('SiteProduction', siteProductionSchema, 'sites_production');
