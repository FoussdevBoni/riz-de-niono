import { Schema } from 'mongoose';

import { champsOperationValidable } from '../../../database/operationValidableSchema.js';
import { ACTIVITES } from '../../utilisateurs/schemas/utilisateurSchema.js';

export const MODES_PAIEMENT = ['especes', 'virement', 'cheque', 'mobile_money'] as const;
export type ModePaiement = (typeof MODES_PAIEMENT)[number];

export const reglementFournisseurSchema = new Schema(
  {
    achat_id: { type: Schema.Types.ObjectId, required: true, index: true },
    /** Recopiés de l'achat à la création, pour appliquer le périmètre aux listes de règlements. */
    activite: { type: String, enum: ACTIVITES, required: true },
    site_id: { type: Schema.Types.ObjectId, default: null },
    date_paiement: { type: Date, required: true },
    /** Montant en FCFA. */
    montant: { type: Schema.Types.Decimal128, required: true },
    mode: { type: String, enum: MODES_PAIEMENT, required: true },
    reference: { type: String, default: null, trim: true },
    ...champsOperationValidable,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);
