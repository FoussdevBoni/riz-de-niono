import { model, type Types } from 'mongoose';

import type { StatutOperation } from '../../../../database/operationValidableSchema.js';
import { productionSchema } from '../schemas/productionSchema.js';

export interface DocumentProduction {
  _id: Types.ObjectId;
  campagne_id: Types.ObjectId;
  site_id: Types.ObjectId;
  produit_id: Types.ObjectId;
  date_recolte: Date;
  superficie_recoltee_ha: Types.Decimal128;
  quantite: Types.Decimal128;
  statut: StatutOperation;
  validated_at: Date | null;
  validated_by_id: Types.ObjectId | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
}

export const ProductionModel = model('Production', productionSchema, 'productions');
