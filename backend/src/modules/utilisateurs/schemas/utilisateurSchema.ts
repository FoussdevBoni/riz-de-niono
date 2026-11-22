import { Schema } from 'mongoose';

export const ACTIVITES = ['production', 'transformation', 'commercialisation'] as const;
export type Activite = (typeof ACTIVITES)[number];

export const utilisateurSchema = new Schema(
  {
    nom: { type: String, required: true, trim: true },
    /** Adresse normalisée (minuscules, sans espaces) et unique. */
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mot_de_passe_hash: { type: String, required: true },
    actif: { type: Boolean, default: true },
    role_id: { type: Schema.Types.ObjectId, required: true, index: true },
    /** Activités accessibles à l'utilisateur. */
    activites: { type: [{ type: String, enum: ACTIVITES }], default: [] },
    /** Sites de production autorisés ; une liste vide signifie tous les sites. */
    site_ids: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);
