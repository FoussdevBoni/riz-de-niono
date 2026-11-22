import { model, type Types } from 'mongoose';

import { utilisateurSchema, type Activite } from '../schemas/utilisateurSchema.js';

export interface DocumentUtilisateur {
  _id: Types.ObjectId;
  nom: string;
  email: string;
  mot_de_passe_hash: string;
  actif: boolean;
  role_id: Types.ObjectId;
  activites: Activite[];
  site_ids: Types.ObjectId[];
  created_at: Date;
  updated_at: Date;
}

export const UtilisateurModel = model('Utilisateur', utilisateurSchema, 'utilisateurs');
