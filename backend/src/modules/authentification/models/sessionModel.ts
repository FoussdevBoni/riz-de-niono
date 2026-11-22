import { model, type Types } from 'mongoose';

import { sessionSchema } from '../schemas/sessionSchema.js';

export interface DocumentSession {
  _id: Types.ObjectId;
  utilisateur_id: Types.ObjectId;
  jeton_hash: string;
  expire_at: Date;
}

export const SessionModel = model('Session', sessionSchema, 'sessions');
