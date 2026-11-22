import { Schema } from 'mongoose';

export const STATUTS_CAMPAGNE = ['brouillon', 'ouverte', 'cloturee'] as const;
export type StatutCampagne = (typeof STATUTS_CAMPAGNE)[number];

export const campagneAgricoleSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    nom: { type: String, required: true, trim: true },
    date_debut: { type: Date, required: true },
    date_fin: { type: Date, required: true },
    /** Sites associés à la campagne. */
    site_ids: { type: [Schema.Types.ObjectId], default: [], index: true },
    supprimee_le: { type: Date },
    statut: { type: String, enum: STATUTS_CAMPAGNE, default: 'brouillon', index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);
