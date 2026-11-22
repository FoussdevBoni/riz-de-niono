import { Schema } from 'mongoose';

import { ACTIVITES } from '../../utilisateurs/schemas/utilisateurSchema.js';

/** Fiche d'équipement ; ses frais d'entretien sont enregistrés dans Dépenses. */
export const materielSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    nom: { type: String, required: true, trim: true },
    /** Activités qui utilisent l'équipement. */
    activites: { type: [{ type: String, enum: ACTIVITES }], default: [], index: true },
    quantite_totale: { type: Schema.Types.Decimal128, required: true },
    /** Comprise entre zéro et la quantité totale. */
    quantite_disponible: { type: Schema.Types.Decimal128, required: true },
    actif: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);
