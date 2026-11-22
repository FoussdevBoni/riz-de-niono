import { Schema } from 'mongoose';

/** Fiche fournisseur commune aux trois activités. */
export const fournisseurSchema = new Schema(
  {
    nom: { type: String, required: true, trim: true },
    telephone: { type: String, default: null, trim: true },
    adresse: { type: String, default: null, trim: true },
    actif: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);

fournisseurSchema.index({ nom: 1 });
