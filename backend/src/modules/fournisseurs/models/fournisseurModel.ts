import { model, type Types } from 'mongoose';

import { fournisseurSchema } from '../schemas/fournisseurSchema.js';

export interface DocumentFournisseur {
  _id: Types.ObjectId;
  nom: string;
  telephone: string | null;
  adresse: string | null;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export const FournisseurModel = model('Fournisseur', fournisseurSchema, 'fournisseurs');
