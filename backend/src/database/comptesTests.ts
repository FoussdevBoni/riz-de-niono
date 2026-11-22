/**
 * Crée ou remet à niveau, dans la base de tests Atlas, un compte administrateur
 * et un compte aux droits limités. Opération idempotente : relancer la commande
 * rétablit les rôles, les périmètres et les mots de passe de la configuration locale.
 *
 * Utilisation : npm run comptes:tests
 * Identifiants lus dans .env : COMPTE_TEST_ADMIN_EMAIL, COMPTE_TEST_ADMIN_MOT_DE_PASSE,
 * COMPTE_TEST_LIMITE_EMAIL, COMPTE_TEST_LIMITE_MOT_DE_PASSE.
 */
import { pathToFileURL } from 'node:url';

import mongoose from 'mongoose';

import { configuration } from '../config/configuration.js';
import { authentificationService } from '../modules/authentification/services/authentificationService.js';
import {
  ACTIONS_PERMISSIONS,
  MODULES_PERMISSIONS,
  roleService,
  type Permission,
} from '../modules/roles/services/roleService.js';
import { typeDepenseService } from '../modules/types-depenses/services/typeDepenseService.js';
import { utilisateurService, type Activite } from '../modules/utilisateurs/services/utilisateurService.js';
import { connecterMongo, deconnecterMongo } from './connexionMongo.js';

export interface CompteTest {
  email: string;
  mot_de_passe: string;
}

const ROLE_ADMINISTRATEUR = {
  code: 'administrateur',
  nom: 'Administrateur',
  permissions: MODULES_PERMISSIONS.flatMap((module) => ACTIONS_PERMISSIONS.map((action) => ({ module, action }))),
};

/** Agent de terrain en production : consultation et saisie des opérations, aucun droit d'administration. */
const ROLE_AGENT_PRODUCTION = {
  code: 'agent_production',
  nom: 'Agent de production',
  permissions: [
    { module: 'tableau_de_bord_production', action: 'consultation' },
    { module: 'campagnes_agricoles', action: 'consultation' },
    { module: 'sites_production', action: 'consultation' },
    { module: 'cultures', action: 'consultation' },
    { module: 'operations_agricoles', action: 'consultation' },
    { module: 'operations_agricoles', action: 'saisie' },
    { module: 'productions', action: 'consultation' },
    { module: 'productions', action: 'saisie' },
    { module: 'produits', action: 'consultation' },
    { module: 'categories_produits', action: 'consultation' },
    { module: 'types_operations_agricoles', action: 'consultation' },
    { module: 'equipes_production', action: 'consultation' },
    { module: 'stock', action: 'consultation' },
  ] satisfies Permission[],
};

function lireCompte(prefixe: string): CompteTest {
  const email = process.env[`${prefixe}_EMAIL`];
  const mot_de_passe = process.env[`${prefixe}_MOT_DE_PASSE`];
  if (!email || !mot_de_passe) {
    throw new Error(`Renseigner ${prefixe}_EMAIL et ${prefixe}_MOT_DE_PASSE dans backend/.env.`);
  }
  return { email: email.trim().toLowerCase(), mot_de_passe };
}

async function assurerRole(role: { code: string; nom: string; permissions: Permission[] }): Promise<string> {
  const systeme = authentificationService.contexteSysteme();
  const id = await roleService.trouverIdParCode(role.code);
  if (id) {
    await roleService.modifier(systeme, id, { nom: role.nom, permissions: role.permissions, actif: true });
    return id;
  }
  return (await roleService.creer(systeme, role))._id;
}

async function assurerUtilisateur(
  compte: CompteTest,
  nom: string,
  role_id: string,
  activites: Activite[],
): Promise<void> {
  const systeme = authentificationService.contexteSysteme();
  const donnees = { nom, email: compte.email, mot_de_passe: compte.mot_de_passe, role_id, activites, site_ids: [], actif: true };
  const id = await utilisateurService.trouverIdParEmail(compte.email);
  if (id) await utilisateurService.modifier(systeme, id, donnees);
  else await utilisateurService.creer(systeme, donnees);
}

/** À appeler sur une connexion ouverte vers la base de tests. */
export async function initialiserComptesTests(): Promise<{ administrateur: CompteTest; limite: CompteTest }> {
  const base = mongoose.connection.db?.databaseName;
  if (base !== configuration.mongodbBaseTests) {
    throw new Error(`Les comptes de tests ne sont créés que dans « ${configuration.mongodbBaseTests} » (base ouverte : ${base}).`);
  }
  const administrateur = lireCompte('COMPTE_TEST_ADMIN');
  const limite = lireCompte('COMPTE_TEST_LIMITE');

  // Crée les index (uniques et TTL) des modèles chargés avant toute écriture.
  await mongoose.connection.syncIndexes();

  await typeDepenseService.assurerTypesReference();
  const roleAdministrateur = await assurerRole(ROLE_ADMINISTRATEUR);
  const roleAgent = await assurerRole(ROLE_AGENT_PRODUCTION);
  await assurerUtilisateur(administrateur, 'Administrateur des tests', roleAdministrateur, [
    'production',
    'transformation',
    'commercialisation',
  ]);
  await assurerUtilisateur(limite, 'Agent de production des tests', roleAgent, ['production']);
  return { administrateur, limite };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  connecterMongo(configuration.mongodbBaseTests)
    .then(initialiserComptesTests)
    .then(({ administrateur, limite }) => {
      console.log(`Comptes prêts dans « ${configuration.mongodbBaseTests} » :`);
      console.log(`- administrateur : ${administrateur.email}`);
      console.log(`- droits limités (agent_production) : ${limite.email}`);
      console.log('Mots de passe : voir backend/.env.');
    })
    .catch((erreur: unknown) => {
      console.error('Échec :', erreur instanceof Error ? erreur.message : erreur);
      process.exitCode = 1;
    })
    .finally(() => deconnecterMongo());
}
