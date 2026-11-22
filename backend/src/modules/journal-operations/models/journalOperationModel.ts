import { model } from 'mongoose';

import { journalOperationSchema } from '../schemas/journalOperationSchema.js';

export const JournalOperationModel = model('JournalOperation', journalOperationSchema, 'journal_operations');
