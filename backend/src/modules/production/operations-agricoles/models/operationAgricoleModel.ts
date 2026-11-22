import { model, type Types } from 'mongoose';

import type { StatutOperation } from '../../../../database/operationValidableSchema.js';
import { operationAgricoleSchema } from '../schemas/operationAgricoleSchema.js';

export interface DocumentIntrant {
  ligne_id: Types.ObjectId;
  produit_id: Types.ObjectId;
  quantite: Types.Decimal128;
}

export interface DocumentOperationAgricole {
  _id: Types.ObjectId;
  campagne_id: Types.ObjectId;
  site_id: Types.ObjectId;
  type_operation_id: Types.ObjectId;
  equipe_id: Types.ObjectId | null;
  date_operation: Date;
  journees_travail: Types.Decimal128 | null;
  cout_main_oeuvre: Types.Decimal128 | null;
  intrants: DocumentIntrant[];
  statut: StatutOperation;
  validated_at: Date | null;
  validated_by_id: Types.ObjectId | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
}

export const OperationAgricoleModel = model('OperationAgricole', operationAgricoleSchema, 'operations_agricoles');
