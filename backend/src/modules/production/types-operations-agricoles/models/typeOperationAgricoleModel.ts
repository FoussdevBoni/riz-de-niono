import { model, type Types } from 'mongoose';

import { typeOperationAgricoleSchema } from '../schemas/typeOperationAgricoleSchema.js';

export interface DocumentTypeOperationAgricole {
  _id: Types.ObjectId;
  code: string;
  nom: string;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export const TypeOperationAgricoleModel = model('TypeOperationAgricole', typeOperationAgricoleSchema, 'types_operations_agricoles');
