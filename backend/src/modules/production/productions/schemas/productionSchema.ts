import { Schema } from 'mongoose';

import { champsOperationValidable } from '../../../../database/operationValidableSchema.js';

/** Récolte d'un produit sur un site pour une campagne. La validation crée l'entrée en stock. */
export const productionSchema = new Schema(
  {
    campagne_id: { type: Schema.Types.ObjectId, required: true },
    site_id: { type: Schema.Types.ObjectId, required: true },
    produit_id: { type: Schema.Types.ObjectId, required: true },
    date_recolte: { type: Date, required: true },
    superficie_recoltee_ha: { type: Schema.Types.Decimal128, required: true },
    /** Quantité récoltée, dans l'unité de stock du produit. */
    quantite: { type: Schema.Types.Decimal128, required: true },
    ...champsOperationValidable,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);

productionSchema.index({ campagne_id: 1, site_id: 1, date_recolte: -1 });
