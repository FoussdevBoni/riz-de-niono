import { Schema } from 'mongoose';

import { champsOperationValidable } from '../../../database/operationValidableSchema.js';

/**
 * Ligne comptée : le serveur relève le stock théorique et sa version à la saisie ;
 * la validation n'applique l'écart que si la version n'a pas changé.
 */
const ligneInventaireSchema = new Schema(
  {
    ligne_id: { type: Schema.Types.ObjectId, required: true },
    produit_id: { type: Schema.Types.ObjectId, required: true },
    quantite_theorique: { type: Schema.Types.Decimal128, required: true },
    version_stock: { type: Number, required: true },
    quantite_comptee: { type: Schema.Types.Decimal128, required: true },
    motif_ecart: { type: String, default: null, trim: true },
  },
  { _id: false },
);

export const inventaireSchema = new Schema(
  {
    date_inventaire: { type: Date, required: true },
    lignes: { type: [ligneInventaireSchema], default: [] },
    ...champsOperationValidable,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);

inventaireSchema.index({ date_inventaire: -1 });
