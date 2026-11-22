import { Schema } from 'mongoose';

export const siteProductionSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    nom: { type: String, required: true, trim: true },
    localisation: { type: String, default: null, trim: true },
    superficie_ha: { type: Schema.Types.Decimal128, default: null },
    /** Utilisateur responsable du site. */
    responsable_id: { type: Schema.Types.ObjectId, default: null },
    actif: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);
