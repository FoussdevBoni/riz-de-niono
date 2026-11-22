import { model, type Types } from 'mongoose';

import { typeDepenseSchema } from '../schemas/typeDepenseSchema.js';

export interface DocumentTypeDepense {
  _id: Types.ObjectId;
  code: string;
  nom: string;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export const TypeDepenseModel = model('TypeDepense', typeDepenseSchema, 'types_depenses');
