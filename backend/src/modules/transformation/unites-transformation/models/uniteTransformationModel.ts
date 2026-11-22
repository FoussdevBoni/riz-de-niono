import { model, type Types } from 'mongoose';

import { uniteTransformationSchema } from '../schemas/uniteTransformationSchema.js';

export interface DocumentUniteTransformation {
  _id: Types.ObjectId;
  code: string;
  nom: string;
  localisation: string | null;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export const UniteTransformationModel = model('UniteTransformation', uniteTransformationSchema, 'unites_transformation');
