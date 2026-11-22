/**
 * Copie les données de la base de tests (MONGODB_BASE_TESTS) vers la base de l'application (MONGODB_BASE),
 * par exemple pour présenter les données de démonstration en production.
 *
 * - La base cible est vidée puis remplie : toutes ses collections sont remplacées.
 * - Les documents gardent leurs identifiants : toutes les références restent valides.
 * - Les sessions et les jetons de réinitialisation ne sont pas copiés (chacun se reconnecte).
 * - Les index de tous les modèles sont recréés, puis les nombres de documents sont comparés.
 *
 * Utilisation : npm run base:copier-tests -- --confirmer
 * Sans --confirmer, le script affiche seulement ce qu'il ferait.
 */
import mongoose from 'mongoose';

import { configuration } from '../config/configuration.js';
// Enregistre tous les modèles (via les routes) pour recréer leurs index.
import '../http/apiRouter.js';
import { connecterMongo, deconnecterMongo } from './connexionMongo.js';

const NON_COPIEES = new Set(['sessions', 'jetons_reinitialisation']);
const TAILLE_LOT = 500;

async function copier(): Promise<void> {
  const source = configuration.mongodbBaseTests;
  const cible = configuration.mongodbBase;
  if (source === cible) throw new Error(`Base source et base cible identiques (${cible}).`);
  const confirme = process.argv.includes('--confirmer');

  const connexionSource = await mongoose
    .createConnection(configuration.mongodbUri, { dbName: source, serverSelectionTimeoutMS: 15000 })
    .asPromise();
  const collections = (await connexionSource.db!.listCollections({}, { nameOnly: true }).toArray())
    .map(({ name }) => name)
    .filter((nom) => !nom.startsWith('system.') && !NON_COPIEES.has(nom))
    .sort();

  const attendus: Record<string, number> = {};
  for (const nom of collections) attendus[nom] = await connexionSource.db!.collection(nom).countDocuments();
  console.log(`Source « ${source} » → cible « ${cible} » : ${collections.length} collections.`);

  if (!confirme) {
    console.log(JSON.stringify(attendus, null, 1));
    console.log('Simulation uniquement. Relancer avec --confirmer pour remplacer le contenu de la base cible.');
    await connexionSource.close();
    return;
  }

  await connecterMongo(cible);
  const baseCible = mongoose.connection.db!;

  // La cible est entièrement remplacée, y compris les collections absentes de la source.
  for (const { name } of await baseCible.listCollections({}, { nameOnly: true }).toArray()) {
    if (!name.startsWith('system.')) await baseCible.collection(name).drop();
  }

  for (const nom of collections) {
    const destination = baseCible.collection(nom);
    let lot: Record<string, unknown>[] = [];
    for await (const document of connexionSource.db!.collection(nom).find()) {
      lot.push(document);
      if (lot.length === TAILLE_LOT) {
        await destination.insertMany(lot, { ordered: true });
        lot = [];
      }
    }
    if (lot.length) await destination.insertMany(lot, { ordered: true });
  }
  await connexionSource.close();

  await mongoose.connection.syncIndexes();

  const ecarts: string[] = [];
  for (const nom of collections) {
    const obtenu = await baseCible.collection(nom).countDocuments();
    if (obtenu !== attendus[nom]) ecarts.push(`${nom} : ${obtenu} au lieu de ${attendus[nom]}`);
  }
  if (ecarts.length) throw new Error(`Copie incomplète :\n${ecarts.join('\n')}`);

  const total = Object.values(attendus).reduce((somme, nombre) => somme + nombre, 0);
  console.log(`Copie terminée et vérifiée : ${total} documents dans ${collections.length} collections, index recréés.`);
}

copier()
  .catch((erreur: unknown) => {
    console.error('Échec :', erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  })
  .finally(() => deconnecterMongo());
