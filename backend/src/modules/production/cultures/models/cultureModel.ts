import { model, type Types } from 'mongoose';

import { cultureSchema } from '../schemas/cultureSchema.js';

export interface DocumentCulture {
  _id: Types.ObjectId;
  campagne_id: Types.ObjectId;
  site_id: Types.ObjectId;
  culture: string;
  variete: string | null;
  superficie_ha: Types.Decimal128;
  date_semis: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const CultureModel = model('Culture', cultureSchema, 'cultures');
