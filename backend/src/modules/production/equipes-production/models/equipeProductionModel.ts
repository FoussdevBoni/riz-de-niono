import { model, type Types } from 'mongoose';

import { equipeProductionSchema } from '../schemas/equipeProductionSchema.js';

export interface DocumentEquipeProduction {
  _id: Types.ObjectId;
  nom: string;
  membres: string[];
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export const EquipeProductionModel = model('EquipeProduction', equipeProductionSchema, 'equipes_production');
