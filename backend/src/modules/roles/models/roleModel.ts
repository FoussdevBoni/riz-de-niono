import { model, type Types } from 'mongoose';

import { roleSchema, type Permission } from '../schemas/roleSchema.js';

export interface DocumentRole {
  _id: Types.ObjectId;
  code: string;
  nom: string;
  permissions: Permission[];
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export const RoleModel = model('Role', roleSchema, 'roles');
