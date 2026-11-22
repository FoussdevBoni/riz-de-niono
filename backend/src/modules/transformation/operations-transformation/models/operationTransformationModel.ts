import { model, type Types } from 'mongoose';

import type { StatutOperation } from '../../../../database/operationValidableSchema.js';
import { operationTransformationSchema } from '../schemas/operationTransformationSchema.js';

export interface DocumentResultatTransformation {
  ligne_id: Types.ObjectId;
  produit_id: Types.ObjectId;
  quantite: Types.Decimal128;
}

export interface DocumentOperationTransformation {
  _id: Types.ObjectId;
  unite_transformation_id: Types.ObjectId;
  date_operation: Date;
  paddy_produit_id: Types.ObjectId;
  quantite_paddy: Types.Decimal128;
  resultats: DocumentResultatTransformation[];
  note_ecart: string | null;
  statut: StatutOperation;
  validated_at: Date | null;
  validated_by_id: Types.ObjectId | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
}

export const OperationTransformationModel = model(
  'OperationTransformation',
  operationTransformationSchema,
  'operations_transformation',
);
