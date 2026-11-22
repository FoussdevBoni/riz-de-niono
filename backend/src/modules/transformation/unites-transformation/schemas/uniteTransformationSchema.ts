import { Schema } from 'mongoose';

export const uniteTransformationSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    nom: { type: String, required: true, trim: true },
    localisation: { type: String, default: null, trim: true },
    actif: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);
