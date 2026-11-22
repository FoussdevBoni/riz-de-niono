import { model, type Types } from 'mongoose';

import type { StatutOperation } from '../../../database/operationValidableSchema.js';
import { venteSchema, type ActiviteVente } from '../schemas/venteSchema.js';

export interface DocumentLigneVente {
  ligne_id: Types.ObjectId;
  produit_id: Types.ObjectId;
  quantite: Types.Decimal128;
  prix_unitaire: Types.Decimal128;
  quantite_retournee: Types.Decimal128;
}

export interface DocumentVente {
  _id: Types.ObjectId;
  client_id: Types.ObjectId;
  commande_id: Types.ObjectId | null;
  activite: ActiviteVente;
  date_vente: Date;
  lignes: DocumentLigneVente[];
  montant_total: Types.Decimal128;
  montant_encaisse: Types.Decimal128;
  montant_retours: Types.Decimal128;
  statut: StatutOperation;
  validated_at: Date | null;
  validated_by_id: Types.ObjectId | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
}

export const VenteModel = model('Vente', venteSchema, 'ventes');
