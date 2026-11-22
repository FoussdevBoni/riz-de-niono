/**
 * Prépare la base de l'application (MONGODB_BASE, riz_de_niono par défaut) avant sa mise en service.
 *
 * 1. Crée les index de toutes les collections (uniques, TTL) : en production, l'API ne les crée pas
 *    elle-même (autoIndex désactivé), et l'unicité des codes et des adresses en dépend.
 * 2. Assure les référentiels de référence et les rôles « administrateur » et « agent_production ».
 * 3. Crée le premier administrateur, seulement si ADMIN_INITIAL_EMAIL et ADMIN_INITIAL_MOT_DE_PASSE
 *    sont fournis et qu'aucun compte n'existe encore avec cette adresse. Un compte existant n'est
 *    jamais modifié. Le mot de passe n'est ni affiché ni conservé.
 *
 * Utilisation (PowerShell) :
 *   $env:ADMIN_INITIAL_EMAIL="…"; $env:ADMIN_INITIAL_NOM="…"; $env:ADMIN_INITIAL_MOT_DE_PASSE="…"; npm run base:production
 * Sans ces variables, seules les étapes 1 et 2 sont exécutées.
 */
import mongoose from 'mongoose';

import { configuration } from '../config/configuration.js';
// Enregistre tous les modèles (via les routes) pour que la création des index les couvre tous.
import '../http/apiRouter.js';
import { authentificationService } from '../modules/authentification/services/authentificationService.js';
import { parametreEntrepriseService } from '../modules/parametres-entreprise/services/parametreEntrepriseService.js';
import { typeDepenseService } from '../modules/types-depenses/services/typeDepenseService.js';
import { utilisateurService } from '../modules/utilisateurs/services/utilisateurService.js';
import { assurerRole, ROLE_ADMINISTRATEUR, ROLE_AGENT_PRODUCTION } from './comptesTests.js';
import { connecterMongo, deconnecterMongo } from './connexionMongo.js';

async function initialiser(): Promise<void> {
  const base = configuration.mongodbBase;
  if (base === configuration.mongodbBaseTests) {
    throw new Error(`Ce script prépare la base de l'application, pas la base de tests (${base}).`);
  }
  await connecterMongo(base);

  await mongoose.connection.syncIndexes();
  console.log(`Index créés pour ${Object.keys(mongoose.models).length} modèles dans « ${base} ».`);

  await typeDepenseService.assurerTypesReference();
  await parametreEntrepriseService.assurerParametres();
  const roleAdministrateur = await assurerRole(ROLE_ADMINISTRATEUR);
  await assurerRole(ROLE_AGENT_PRODUCTION);
  console.log('Référentiels de référence et rôles prêts.');

  const email = process.env.ADMIN_INITIAL_EMAIL?.trim().toLowerCase();
  const motDePasse = process.env.ADMIN_INITIAL_MOT_DE_PASSE;
  if (!email || !motDePasse) {
    console.log('Aucun administrateur créé : ADMIN_INITIAL_EMAIL et ADMIN_INITIAL_MOT_DE_PASSE non fournis.');
    return;
  }
  if (await utilisateurService.trouverIdParEmail(email)) {
    console.log(`Le compte ${email} existe déjà : il n'est pas modifié.`);
    return;
  }
  await utilisateurService.creer(authentificationService.contexteSysteme(), {
    nom: process.env.ADMIN_INITIAL_NOM?.trim() || 'Administrateur',
    email,
    mot_de_passe: motDePasse,
    role_id: roleAdministrateur,
    activites: ['production', 'transformation', 'commercialisation'],
    site_ids: [],
    actif: true,
  });
  console.log(`Administrateur créé : ${email}.`);
}

initialiser()
  .catch((erreur: unknown) => {
    console.error('Échec :', erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  })
  .finally(() => deconnecterMongo());
