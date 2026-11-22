import { Schema } from 'mongoose';

/** Code du document unique des paramètres de l'entreprise. */
export const CODE_PARAMETRES = 'PRINCIPAL';

const coordonneesSchema = new Schema(
  {
    adresse: { type: String, default: null, trim: true },
    telephone: { type: String, default: null, trim: true },
    email: { type: String, default: null, trim: true },
  },
  { _id: false },
);

export const parametreEntrepriseSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    nom: { type: String, required: true, trim: true },
    coordonnees: { type: coordonneesSchema, default: () => ({}) },
    /** Code ISO 4217 ; XOF pour le franc CFA (montants exprimés en FCFA). */
    devise: { type: String, required: true, default: 'XOF', uppercase: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);
