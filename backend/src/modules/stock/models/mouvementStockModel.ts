import { model, type Types } from 'mongoose';

import { mouvementStockSchema, type SensMouvement, type TypeOrigine } from '../schemas/mouvementStockSchema.js';

export interface DocumentMouvementStock {
  _id: Types.ObjectId;
  produit_id: Types.ObjectId;
  sens: SensMouvement;
  quantite: Types.Decimal128;
  date_mouvement: Date;
  origine_type: TypeOrigine;
  origine_id: Types.ObjectId;
  ligne_id: Types.ObjectId | null;
  cle_mouvement: string;
  annule_mouvement_id: Types.ObjectId | null;
  motif: string | null;
  utilisateur_id: Types.ObjectId | null;
  created_at: Date;
}

export const MouvementStockModel = model('MouvementStock', mouvementStockSchema, 'mouvements_stock');
