import { Schema } from 'mongoose';

/** Fiche client, utilisée par les ventes de production et la commercialisation. */
export const clientSchema = new Schema(
  {
    nom: { type: String, required: true, trim: true },
    telephone: { type: String, default: null, trim: true },
    adresse: { type: String, default: null, trim: true },
    actif: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);

clientSchema.index({ nom: 1 });
