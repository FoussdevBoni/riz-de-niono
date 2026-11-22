import { Schema } from 'mongoose';

import { champsOperationValidable } from '../../../../database/operationValidableSchema.js';

/** Produit obtenu par la transformation (riz, son, brisures...) ; une entrée en stock par ligne. */
const resultatSchema = new Schema(
  {
    ligne_id: { type: Schema.Types.ObjectId, required: true },
    produit_id: { type: Schema.Types.ObjectId, required: true },
    quantite: { type: Schema.Types.Decimal128, required: true },
  },
  { _id: false },
);

export const operationTransformationSchema = new Schema(
  {
    unite_transformation_id: { type: Schema.Types.ObjectId, required: true },
    date_operation: { type: Date, required: true },
    /** Produit consommé (paddy) et quantité réellement consommée, dans son unité de stock. */
    paddy_produit_id: { type: Schema.Types.ObjectId, required: true },
    quantite_paddy: { type: Schema.Types.Decimal128, required: true },
    resultats: { type: [resultatSchema], default: [] },
    /** Explication des pertes ou écarts constatés. */
    note_ecart: { type: String, default: null, trim: true },
    ...champsOperationValidable,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);

operationTransformationSchema.index({ unite_transformation_id: 1, date_operation: -1 });
