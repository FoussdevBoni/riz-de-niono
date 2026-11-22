import { Schema } from 'mongoose';

export const equipeProductionSchema = new Schema(
  {
    nom: { type: String, required: true, trim: true },
    /** Noms des membres saisis pour la démonstration. */
    membres: { type: [String], default: [] },
    actif: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);
