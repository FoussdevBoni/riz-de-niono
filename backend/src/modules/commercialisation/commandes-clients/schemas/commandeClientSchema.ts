import { Schema } from 'mongoose';

export const STATUTS_COMMANDE = ['en_cours', 'en_expedition', 'livree', 'annulee'] as const;
export type StatutCommande = (typeof STATUTS_COMMANDE)[number];

/** Ligne de commande au prix appliqué (prix du produit repris si omis à la saisie). */
const ligneCommandeSchema = new Schema(
  {
    ligne_id: { type: Schema.Types.ObjectId, required: true },
    produit_id: { type: Schema.Types.ObjectId, required: true },
    quantite: { type: Schema.Types.Decimal128, required: true },
    prix_unitaire: { type: Schema.Types.Decimal128, required: true },
  },
  { _id: false },
);

export const commandeClientSchema = new Schema(
  {
    client_id: { type: Schema.Types.ObjectId, required: true },
    date_commande: { type: Date, required: true },
    lignes: { type: [ligneCommandeSchema], default: [] },
    montant_total: { type: Schema.Types.Decimal128, required: true },
    statut: { type: String, enum: STATUTS_COMMANDE, default: 'en_cours', index: true },
    expediee_at: { type: Date, default: null },
    livree_at: { type: Date, default: null },
    livree_par_id: { type: Schema.Types.ObjectId, default: null },
    /** Vente créée par la livraison. */
    vente_id: { type: Schema.Types.ObjectId, default: null },
    motif_annulation: { type: String, default: null },
    annulee_at: { type: Date, default: null },
    annulee_par_id: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);

commandeClientSchema.index({ client_id: 1, date_commande: -1 });
