import mongoose, { type ClientSession } from 'mongoose';

/**
 * Exécute une opération dans une transaction MongoDB.
 * withTransaction relance l'opération en cas de conflit d'écriture transitoire
 * et annule toutes les écritures en cas d'échec. Le service qui coordonne
 * l'opération transmet la session reçue aux services et modèles appelés.
 */
export async function executerTransaction<T>(
  operation: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => operation(session));
  } finally {
    await session.endSession();
  }
}
