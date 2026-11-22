/**
 * Vérifie l'accès au cluster Atlas sur la base de tests : connexion, replica set
 * et transaction réelle (écriture puis suppression d'un document témoin).
 * Utilisation : npm run mongo:verifier
 */
import mongoose from 'mongoose';

import { configuration } from '../config/configuration.js';
import { connecterMongo, deconnecterMongo } from './connexionMongo.js';
import { executerTransaction } from './transactionMongo.js';

const COLLECTION_TEMOIN = 'verifications_connexion';

async function verifier(): Promise<void> {
  await connecterMongo(configuration.mongodbBaseTests);
  const base = mongoose.connection.db!;
  console.log(`Connexion établie : base « ${base.databaseName} ».`);

  const collection = base.collection(COLLECTION_TEMOIN);
  const { insertedId } = await executerTransaction((session) =>
    collection.insertOne({ verifie_at: new Date() }, { session }),
  );
  await executerTransaction((session) => collection.deleteOne({ _id: insertedId }, { session }));
  await collection.drop().catch(() => undefined);
  console.log('Transaction validée : écriture et suppression réussies.');
}

verifier()
  .catch((erreur: unknown) => {
    console.error('Échec :', erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  })
  .finally(() => deconnecterMongo());
