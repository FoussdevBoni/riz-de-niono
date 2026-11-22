import { model, type Types } from 'mongoose';

import type { StatutOperation } from '../../../database/operationValidableSchema.js';
import type { Activite } from '../../utilisateurs/schemas/utilisateurSchema.js';
import { achatSchema, type StatutReception } from '../schemas/achatSchema.js';

export interface DocumentLigneAchat {
  ligne_id: Types.ObjectId;
  libelle: string;
  produit_id: Types.ObjectId | null;
  quantite: Types.Decimal128;
  prix_unitaire: Types.Decimal128;
}

export interface DocumentAchat {
  _id: Types.ObjectId;
  activite: Activite;
  fournisseur_id: Types.ObjectId;
  date_achat: Date;
  site_id: Types.ObjectId | null;
  campagne_id: Types.ObjectId | null;
  unite_transformation_id: Types.ObjectId | null;
  lignes: DocumentLigneAchat[];
  montant_total: Types.Decimal128;
  montant_regle: Types.Decimal128;
  statut_reception: StatutReception | null;
  recu_at: Date | null;
  recu_par_id: Types.ObjectId | null;
  statut: StatutOperation;
  validated_at: Date | null;
  validated_by_id: Types.ObjectId | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
}

export const AchatModel = model('Achat', achatSchema, 'achats');
