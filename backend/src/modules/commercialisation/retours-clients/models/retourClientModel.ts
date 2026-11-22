import { model, type Types } from 'mongoose';

import type { StatutOperation } from '../../../../database/operationValidableSchema.js';
import { retourClientSchema } from '../schemas/retourClientSchema.js';

export interface DocumentLigneRetour {
  ligne_id: Types.ObjectId;
  ligne_vente_id: Types.ObjectId;
  produit_id: Types.ObjectId;
  quantite: Types.Decimal128;
  quantite_revendable: Types.Decimal128;
  prix_unitaire: Types.Decimal128;
  motif: string;
}

export interface DocumentRetourClient {
  _id: Types.ObjectId;
  vente_id: Types.ObjectId;
  activite: string;
  date_retour: Date;
  lignes: DocumentLigneRetour[];
  montant: Types.Decimal128;
  statut: StatutOperation;
  validated_at: Date | null;
  validated_by_id: Types.ObjectId | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
}

export const RetourClientModel = model('RetourClient', retourClientSchema, 'retours_clients');
