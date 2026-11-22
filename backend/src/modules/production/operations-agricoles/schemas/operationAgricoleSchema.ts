import { Schema } from 'mongoose';

import { champsOperationValidable } from '../../../../database/operationValidableSchema.js';

/** Intrant consommé par le travail ; la validation crée une sortie de stock par ligne. */
const intrantSchema = new Schema(
  {
    ligne_id: { type: Schema.Types.ObjectId, required: true },
    produit_id: { type: Schema.Types.ObjectId, required: true },
    quantite: { type: Schema.Types.Decimal128, required: true },
  },
  { _id: false },
);

export const operationAgricoleSchema = new Schema(
  {
    campagne_id: { type: Schema.Types.ObjectId, required: true },
    site_id: { type: Schema.Types.ObjectId, required: true },
    type_operation_id: { type: Schema.Types.ObjectId, required: true },
    equipe_id: { type: Schema.Types.ObjectId, default: null },
    date_operation: { type: Date, required: true },
    journees_travail: { type: Schema.Types.Decimal128, default: null },
    /** Coût de main-d'œuvre en FCFA. */
    cout_main_oeuvre: { type: Schema.Types.Decimal128, default: null },
    intrants: { type: [intrantSchema], default: [] },
    ...champsOperationValidable,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);

operationAgricoleSchema.index({ campagne_id: 1, site_id: 1, date_operation: -1 });
