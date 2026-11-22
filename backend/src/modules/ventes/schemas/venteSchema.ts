import { Schema } from 'mongoose';

import { champsOperationValidable } from '../../../database/operationValidableSchema.js';

/** Activités qui vendent : production (ventes directes de récolte) et commercialisation. */
export const ACTIVITES_VENTE = ['production', 'commercialisation'] as const;
export type ActiviteVente = (typeof ACTIVITES_VENTE)[number];

/** Ligne vendue avec le prix appliqué à cette vente, conservé même si le catalogue change. */
const ligneVenteSchema = new Schema(
  {
    ligne_id: { type: Schema.Types.ObjectId, required: true },
    produit_id: { type: Schema.Types.ObjectId, required: true },
    quantite: { type: Schema.Types.Decimal128, required: true },
    prix_unitaire: { type: Schema.Types.Decimal128, required: true },
    /** Cumul des retours validés sur cette ligne, tenu dans la transaction de chaque retour. */
    quantite_retournee: { type: Schema.Types.Decimal128, required: true, default: () => '0' },
  },
  { _id: false },
);

export const venteSchema = new Schema(
  {
    client_id: { type: Schema.Types.ObjectId, required: true },
    /** Commande d'origine ; null pour une vente directe. */
    commande_id: { type: Schema.Types.ObjectId, default: null },
    activite: { type: String, enum: ACTIVITES_VENTE, required: true },
    date_vente: { type: Date, required: true },
    lignes: { type: [ligneVenteSchema], default: [] },
    montant_total: { type: Schema.Types.Decimal128, required: true },
    /** Somme des encaissements validés. */
    montant_encaisse: { type: Schema.Types.Decimal128, required: true, default: () => '0' },
    /** Montant des retours validés, au prix de la vente. */
    montant_retours: { type: Schema.Types.Decimal128, required: true, default: () => '0' },
    ...champsOperationValidable,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);

// Une commande ne produit qu'une vente (document 03 : index unique partiel sur commande_id).
venteSchema.index({ commande_id: 1 }, { unique: true, partialFilterExpression: { commande_id: { $type: 'objectId' } } });
venteSchema.index({ client_id: 1, date_vente: -1 });
venteSchema.index({ activite: 1, date_vente: -1 });
