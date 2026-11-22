import { model, type Types } from 'mongoose';

import type { Activite } from '../../utilisateurs/schemas/utilisateurSchema.js';
import { produitSchema } from '../schemas/produitSchema.js';

export interface DocumentProduit {
  _id: Types.ObjectId;
  code: string;
  nom: string;
  categorie_id: Types.ObjectId;
  unite_stock: string;
  activites: Activite[];
  stockable: boolean;
  prix_vente: Types.Decimal128 | null;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export const ProduitModel = model('Produit', produitSchema, 'produits');
