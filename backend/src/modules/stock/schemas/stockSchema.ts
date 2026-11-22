import { Schema } from 'mongoose';

/** Solde global d'un produit. Les écritures passent par des $inc atomiques du service Stock. */
export const stockSchema = new Schema(
  {
    produit_id: { type: Schema.Types.ObjectId, required: true, unique: true },
    quantite_disponible: { type: Schema.Types.Decimal128, required: true, default: () => '0' },
    /** Incrémentée à chaque changement de solde (contrôle des inventaires). */
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);
