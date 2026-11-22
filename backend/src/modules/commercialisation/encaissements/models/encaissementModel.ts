import { model, type Types } from 'mongoose';

import type { StatutOperation } from '../../../../database/operationValidableSchema.js';
import { encaissementSchema, type ModeEncaissement } from '../schemas/encaissementSchema.js';

export interface DocumentEncaissement {
  _id: Types.ObjectId;
  vente_id: Types.ObjectId;
  activite: string;
  date_paiement: Date;
  montant: Types.Decimal128;
  mode: ModeEncaissement;
  reference: string | null;
  statut: StatutOperation;
  validated_at: Date | null;
  validated_by_id: Types.ObjectId | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
}

export const EncaissementModel = model('Encaissement', encaissementSchema, 'encaissements');
