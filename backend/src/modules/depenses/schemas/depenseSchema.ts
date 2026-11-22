import { Schema } from 'mongoose';

import { champsOperationValidable } from '../../../database/operationValidableSchema.js';
import { ACTIVITES } from '../../utilisateurs/schemas/utilisateurSchema.js';

/** Référence du justificatif conservée par la dépense ; le fichier est stocké par le module Média. */
const justificatifSchema = new Schema(
  {
    public_id: { type: String, required: true },
    url_securisee: { type: String, required: true },
    type_ressource: { type: String, enum: ['image', 'raw'], required: true },
    format: { type: String, default: null },
    octets: { type: Number, required: true },
    nom_fichier: { type: String, default: null },
    ajoute_at: { type: Date, required: true },
    ajoute_par_id: { type: Schema.Types.ObjectId, default: null },
  },
  { _id: false },
);

export const depenseSchema = new Schema(
  {
    activite: { type: String, enum: ACTIVITES, required: true },
    type_depense_id: { type: Schema.Types.ObjectId, required: true },
    date_depense: { type: Date, required: true },
    /** Montant en FCFA. */
    montant: { type: Schema.Types.Decimal128, required: true },
    libelle: { type: String, required: true, trim: true },
    site_id: { type: Schema.Types.ObjectId, default: null },
    campagne_id: { type: Schema.Types.ObjectId, default: null },
    unite_transformation_id: { type: Schema.Types.ObjectId, default: null },
    materiel_id: { type: Schema.Types.ObjectId, default: null },
    justificatif: { type: justificatifSchema, default: null },
    ...champsOperationValidable,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);

// Document 03 : index sur campagne_id, site_id et date_depense pour le tableau de bord de production.
depenseSchema.index({ campagne_id: 1, site_id: 1, date_depense: -1 });
depenseSchema.index({ activite: 1, date_depense: -1 });
