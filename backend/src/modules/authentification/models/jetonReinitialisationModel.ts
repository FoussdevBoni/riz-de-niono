import { model, type Types } from 'mongoose';

import { jetonReinitialisationSchema } from '../schemas/jetonReinitialisationSchema.js';

export interface DocumentJetonReinitialisation {
  _id: Types.ObjectId;
  utilisateur_id: Types.ObjectId;
  jeton_hash: string;
  expire_at: Date;
}

export const JetonReinitialisationModel = model(
  'JetonReinitialisation',
  jetonReinitialisationSchema,
  'jetons_reinitialisation',
);
