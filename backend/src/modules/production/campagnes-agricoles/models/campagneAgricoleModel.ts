import { model, type Types } from 'mongoose';

import { campagneAgricoleSchema, type StatutCampagne } from '../schemas/campagneAgricoleSchema.js';

export interface DocumentCampagneAgricole {
  _id: Types.ObjectId;
  code: string;
  nom: string;
  date_debut: Date;
  date_fin: Date;
  site_ids: Types.ObjectId[];
  statut: StatutCampagne;
  created_at: Date;
  updated_at: Date;
}

export const CampagneAgricoleModel = model('CampagneAgricole', campagneAgricoleSchema, 'campagnes_agricoles');
