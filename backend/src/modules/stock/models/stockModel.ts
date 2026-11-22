import { model, type Types } from 'mongoose';

import { stockSchema } from '../schemas/stockSchema.js';

export interface DocumentStock {
  _id: Types.ObjectId;
  produit_id: Types.ObjectId;
  quantite_disponible: Types.Decimal128;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export const StockModel = model('Stock', stockSchema, 'stocks');
