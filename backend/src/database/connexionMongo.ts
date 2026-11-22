import mongoose from 'mongoose';

import { configuration } from '../config/configuration.js';

/**
 * Ouvre la connexion au cluster MongoDB Atlas sur la base indiquée
 * (base de l'application par défaut, base de tests pour les tests)
 * et vérifie la présence d'un replica set, indispensable aux transactions (documents 02 et 03).
 */
export async function connecterMongo(base: string = configuration.mongodbBase): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(configuration.mongodbUri, {
    dbName: base,
    autoIndex: configuration.environnement !== 'production',
    serverSelectionTimeoutMS: 10000,
  });

  const etat = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!etat.setName) {
    await mongoose.disconnect();
    throw new Error('Le serveur MongoDB doit être un replica set (cluster Atlas) pour les transactions.');
  }
}

export async function deconnecterMongo(): Promise<void> {
  await mongoose.disconnect();
}
