import { Schema } from 'mongoose';

import { champsOperationValidable } from '../../../../database/operationValidableSchema.js';

/** Ligne retournée : rattachée à une ligne de vente, dont elle reprend le produit et le prix. */
const ligneRetourSchema = new Schema(
  {
    ligne_id: { type: Schema.Types.ObjectId, required: true },
    ligne_vente_id: { type: Schema.Types.ObjectId, required: true },
    produit_id: { type: Schema.Types.ObjectId, required: true },
    quantite: { type: Schema.Types.Decimal128, required: true },
    /** Part de la quantité retournée qui revient en stock. */
    quantite_revendable: { type: Schema.Types.Decimal128, required: true },
    prix_unitaire: { type: Schema.Types.Decimal128, required: true },
    motif: { type: String, required: true, trim: true },
  },
  { _id: false },
);

export const retourClientSchema = new Schema(
  {
    vente_id: { type: Schema.Types.ObjectId, required: true, index: true },
    /** Recopiée de la vente, pour appliquer le périmètre par activité aux listes. */
    activite: { type: String, required: true },
    date_retour: { type: Date, required: true },
    lignes: { type: [ligneRetourSchema], default: [] },
    /** Montant déduit du dû : quantités retournées au prix de la vente. */
    montant: { type: Schema.Types.Decimal128, required: true },
    ...champsOperationValidable,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);
