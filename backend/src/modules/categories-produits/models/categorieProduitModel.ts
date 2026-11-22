import { model, type Types } from 'mongoose';

import { categorieProduitSchema } from '../schemas/categorieProduitSchema.js';

export interface DocumentCategorieProduit {
  _id: Types.ObjectId;
  code: string;
  nom: string;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export const CategorieProduitModel = model('CategorieProduit', categorieProduitSchema, 'categories_produits');
