import { model, type Types } from 'mongoose';

import { clientSchema } from '../schemas/clientSchema.js';

export interface DocumentClient {
  _id: Types.ObjectId;
  nom: string;
  telephone: string | null;
  adresse: string | null;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export const ClientModel = model('Client', clientSchema, 'clients');
