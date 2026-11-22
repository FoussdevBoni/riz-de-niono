import { Schema } from 'mongoose';

import { champsOperationValidable } from '../../../../database/operationValidableSchema.js';

export const MODES_ENCAISSEMENT = ['especes', 'virement', 'cheque', 'mobile_money'] as const;
export type ModeEncaissement = (typeof MODES_ENCAISSEMENT)[number];

export const encaissementSchema = new Schema(
  {
    vente_id: { type: Schema.Types.ObjectId, required: true, index: true },
    /** Recopiée de la vente, pour appliquer le périmètre par activité aux listes. */
    activite: { type: String, required: true },
    date_paiement: { type: Date, required: true },
    /** Montant en FCFA. */
    montant: { type: Schema.Types.Decimal128, required: true },
    mode: { type: String, enum: MODES_ENCAISSEMENT, required: true },
    reference: { type: String, default: null, trim: true },
    ...champsOperationValidable,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);
