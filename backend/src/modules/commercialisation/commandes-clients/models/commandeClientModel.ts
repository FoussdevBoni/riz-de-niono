import { model, type Types } from 'mongoose';

import { commandeClientSchema, type StatutCommande } from '../schemas/commandeClientSchema.js';

export interface DocumentLigneCommande {
  ligne_id: Types.ObjectId;
  produit_id: Types.ObjectId;
  quantite: Types.Decimal128;
  prix_unitaire: Types.Decimal128;
}

export interface DocumentCommandeClient {
  _id: Types.ObjectId;
  client_id: Types.ObjectId;
  date_commande: Date;
  lignes: DocumentLigneCommande[];
  montant_total: Types.Decimal128;
  statut: StatutCommande;
  expediee_at: Date | null;
  livree_at: Date | null;
  livree_par_id: Types.ObjectId | null;
  vente_id: Types.ObjectId | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
}

export const CommandeClientModel = model('CommandeClient', commandeClientSchema, 'commandes_clients');
