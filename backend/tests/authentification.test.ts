/**
 * Tests d'intégration des modules Authentification, Profil, Utilisateurs et Rôles
 * sur la base Atlas de tests (MONGODB_BASE_TESTS), via un vrai serveur HTTP.
 * Les données créées portent le préfixe « test » et sont supprimées à la fin.
 * Utilisation : npm test
 */
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import mongoose from 'mongoose';

import { creerApplication } from '../src/app.js';
import { configuration } from '../src/config/configuration.js';
import { connecterMongo, deconnecterMongo } from '../src/database/connexionMongo.js';
import { initialiserComptesTests, type CompteTest } from '../src/database/comptesTests.js';
import { authentificationService } from '../src/modules/authentification/services/authentificationService.js';
import { emailService } from '../src/modules/email/services/emailService.js';

interface Reponse {
  statut: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  corps: any;
}

const suffixe = Date.now().toString(36);
const MOT_DE_PASSE_TEMPORAIRE = 'Temporaire-2026!';
/** Liens interceptés et identifiants Resend des envois réels, par destinataire. */
const liensReinitialisation = new Map<string, string>();
const envoisReels = new Map<string, string>();
/** Traitements de réinitialisation lancés en arrière-plan par l'API, attendus par les tests. */
const traitementsEnCours: Promise<void>[] = [];

async function attendreTraitements(): Promise<void> {
  await Promise.all(traitementsEnCours.splice(0));
}

let serveur: Server;
let urlApi: string;
let administrateur: CompteTest;
let limite: CompteTest;
let jetonAdmin: string;
let jetonLimite: string;
let idAdmin: string;
let idRoleAgent: string;

async function appel(
  methode: string,
  chemin: string,
  { jeton, corps }: { jeton?: string; corps?: unknown } = {},
): Promise<Reponse> {
  const entetes: Record<string, string> = {};
  if (jeton) entetes.Authorization = `Bearer ${jeton}`;
  if (corps !== undefined) entetes['Content-Type'] = 'application/json';
  const reponse = await fetch(urlApi + chemin, {
    method: methode,
    headers: entetes,
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  const texte = await reponse.text();
  return { statut: reponse.status, corps: texte ? JSON.parse(texte) : undefined };
}

async function connecter(email: string, motDePasse: string): Promise<string> {
  const reponse = await appel('POST', '/auth/connexion', { corps: { email, mot_de_passe: motDePasse } });
  assert.equal(reponse.statut, 200, JSON.stringify(reponse.corps));
  return reponse.corps.jeton;
}

/** Crée, avec le compte administrateur, un utilisateur de test portant le rôle agent_production. */
async function creerUtilisateurTemporaire(
  nom: string,
  email = `test.${nom}.${suffixe}@riz-de-niono.test`,
): Promise<{ id: string; email: string }> {
  const reponse = await appel('POST', '/utilisateurs', {
    jeton: jetonAdmin,
    corps: { nom: `Test ${nom}`, email, mot_de_passe: MOT_DE_PASSE_TEMPORAIRE, role_id: idRoleAgent, activites: ['production'] },
  });
  assert.equal(reponse.statut, 201, JSON.stringify(reponse.corps));
  return { id: reponse.corps._id, email };
}

function erreur(reponse: Reponse, statut: number, code: string): void {
  assert.equal(reponse.statut, statut, JSON.stringify(reponse.corps));
  assert.equal(reponse.corps?.erreur?.code, code);
}

before(async () => {
  await connecterMongo(configuration.mongodbBaseTests);
  ({ administrateur, limite } = await initialiserComptesTests());
  // Interception du service Email : le lien est capturé ; seules les adresses de test
  // Resend (…@resend.dev) déclenchent un envoi réel, les domaines fictifs ne reçoivent rien.
  const envoyerLien = emailService.envoyerLienReinitialisation;
  emailService.envoyerLienReinitialisation = async (destinataire, lien, dureeMinutes) => {
    liensReinitialisation.set(destinataire, lien);
    if (!destinataire.endsWith('@resend.dev')) return { id: 'intercepte' };
    const resultat = await envoyerLien(destinataire, lien, dureeMinutes);
    envoisReels.set(destinataire, resultat.id);
    return resultat;
  };
  const demander = authentificationService.demanderReinitialisation;
  authentificationService.demanderReinitialisation = (email) => {
    const traitement = demander(email);
    traitementsEnCours.push(traitement);
    return traitement;
  };
  serveur = creerApplication().listen(0);
  urlApi = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}/api/v1`;
});

after(async () => {
  serveur?.close();
  const base = mongoose.connection.db;
  if (!base) return; // Connexion jamais établie : rien à nettoyer.
  const utilisateurs = await base
    .collection('utilisateurs')
    .find({ email: { $regex: '^test\\.|@resend\\.dev$' } }, { projection: { _id: 1 } })
    .toArray();
  const roles = await base.collection('roles').find({ code: { $regex: '^test_' } }, { projection: { _id: 1 } }).toArray();
  const ids = [...utilisateurs, ...roles].map((document) => document._id);
  const idsUtilisateurs = utilisateurs.map((document) => document._id);
  await base.collection('sessions').deleteMany({ utilisateur_id: { $in: idsUtilisateurs } });
  await base.collection('jetons_reinitialisation').deleteMany({ utilisateur_id: { $in: idsUtilisateurs } });
  await base.collection('journal_operations').deleteMany({ document_id: { $in: ids } });
  await base.collection('utilisateurs').deleteMany({ _id: { $in: idsUtilisateurs } });
  await base.collection('roles').deleteMany({ code: { $regex: '^test_' } });
  // Remet les comptes de tests dans leur état de référence.
  await initialiserComptesTests();
  await deconnecterMongo();
});

describe('Authentification : connexion', () => {
  it('ouvre une session pour le compte administrateur et renvoie le profil sans condensat', async () => {
    const reponse = await appel('POST', '/auth/connexion', {
      corps: { email: administrateur.email.toUpperCase(), mot_de_passe: administrateur.mot_de_passe },
    });
    assert.equal(reponse.statut, 200);
    assert.equal(typeof reponse.corps.jeton, 'string');
    assert.ok(new Date(reponse.corps.expire_at) > new Date());
    assert.equal(reponse.corps.profil.email, administrateur.email);
    assert.equal(reponse.corps.profil.role.code, 'administrateur');
    assert.ok(reponse.corps.profil.permissions.length > 100);
    assert.doesNotMatch(JSON.stringify(reponse.corps), /hash/);
    jetonAdmin = reponse.corps.jeton;
    idAdmin = reponse.corps.profil._id;

    jetonLimite = await connecter(limite.email, limite.mot_de_passe);
    const profilLimite = await appel('GET', '/profil', { jeton: jetonLimite });
    idRoleAgent = profilLimite.corps.role._id;
    assert.equal(profilLimite.corps.role.code, 'agent_production');
  });

  it('refuse un mot de passe incorrect ou une adresse inconnue avec le même code', async () => {
    erreur(
      await appel('POST', '/auth/connexion', { corps: { email: administrateur.email, mot_de_passe: 'mauvais-mot' } }),
      401,
      'identifiants_invalides',
    );
    erreur(
      await appel('POST', '/auth/connexion', { corps: { email: `inconnu.${suffixe}@riz-de-niono.test`, mot_de_passe: 'x' } }),
      401,
      'identifiants_invalides',
    );
  });

  it('rejette des données de connexion incomplètes', async () => {
    erreur(await appel('POST', '/auth/connexion', { corps: { mot_de_passe: 'x' } }), 422, 'donnees_invalides');
  });
});

describe('Contrôle des accès', () => {
  it('refuse les routes protégées sans session ou avec un jeton invalide (401)', async () => {
    for (const chemin of ['/profil', '/utilisateurs', '/roles']) {
      erreur(await appel('GET', chemin), 401, 'session_invalide');
      erreur(await appel('GET', chemin, { jeton: 'jeton-inexistant' }), 401, 'session_invalide');
    }
    erreur(await appel('POST', '/auth/deconnexion'), 401, 'session_invalide');
  });

  it('refuse les modules non accordés au rôle limité (403)', async () => {
    erreur(await appel('GET', '/utilisateurs', { jeton: jetonLimite }), 403, 'acces_refuse');
    erreur(await appel('GET', '/roles', { jeton: jetonLimite }), 403, 'acces_refuse');
    erreur(await appel('POST', '/roles', { jeton: jetonLimite, corps: { code: 'test_x', nom: 'X' } }), 403, 'acces_refuse');
    erreur(await appel('PATCH', `/utilisateurs/${idAdmin}`, { jeton: jetonLimite, corps: { nom: 'X' } }), 403, 'acces_refuse');
    assert.equal((await appel('GET', '/profil', { jeton: jetonLimite })).statut, 200);
  });
});

describe('Rôles et permissions', () => {
  let idRole: string;

  it('crée un rôle, dédoublonne ses permissions et refuse un code déjà pris', async () => {
    const corps = {
      code: `test_${suffixe}_lecteur`,
      nom: 'Lecteur de test',
      permissions: [
        { module: 'roles', action: 'consultation' },
        { module: 'roles', action: 'consultation' },
      ],
    };
    const creation = await appel('POST', '/roles', { jeton: jetonAdmin, corps });
    assert.equal(creation.statut, 201, JSON.stringify(creation.corps));
    assert.deepEqual(creation.corps.permissions, [{ module: 'roles', action: 'consultation' }]);
    assert.equal(creation.corps.actif, true);
    idRole = creation.corps._id;

    erreur(await appel('POST', '/roles', { jeton: jetonAdmin, corps }), 409, 'code_deja_utilise');
  });

  it('rejette une permission inconnue ou un code mal formé (422)', async () => {
    erreur(
      await appel('POST', '/roles', {
        jeton: jetonAdmin,
        corps: { code: `test_${suffixe}_faux`, nom: 'Faux', permissions: [{ module: 'inconnu', action: 'consultation' }] },
      }),
      422,
      'donnees_invalides',
    );
    erreur(await appel('POST', '/roles', { jeton: jetonAdmin, corps: { code: 'Code Faux', nom: 'Faux' } }), 422, 'donnees_invalides');
  });

  it('liste, consulte, modifie, archive et réactive un rôle', async () => {
    const liste = await appel('GET', '/roles?actif=true&taille_page=100', { jeton: jetonAdmin });
    assert.equal(liste.statut, 200);
    assert.equal(liste.corps.taille_page, 100);
    assert.ok(liste.corps.items.some((role: { _id: string }) => role._id === idRole));

    assert.equal((await appel('GET', `/roles/${idRole}`, { jeton: jetonAdmin })).corps.code, `test_${suffixe}_lecteur`);
    erreur(await appel('GET', '/roles/000000000000000000000000', { jeton: jetonAdmin }), 404, 'ressource_introuvable');
    erreur(await appel('GET', '/roles/identifiant-invalide', { jeton: jetonAdmin }), 404, 'ressource_introuvable');

    const modification = await appel('PATCH', `/roles/${idRole}`, {
      jeton: jetonAdmin,
      corps: { nom: 'Lecteur renommé', permissions: [{ module: 'utilisateurs', action: 'consultation' }] },
    });
    assert.equal(modification.statut, 200);
    assert.equal(modification.corps.nom, 'Lecteur renommé');

    assert.equal((await appel('PATCH', `/roles/${idRole}`, { jeton: jetonAdmin, corps: { actif: false } })).corps.actif, false);
    const archives = await appel('GET', '/roles?actif=false&taille_page=100', { jeton: jetonAdmin });
    assert.ok(archives.corps.items.some((role: { _id: string }) => role._id === idRole));
    assert.equal((await appel('PATCH', `/roles/${idRole}`, { jeton: jetonAdmin, corps: { actif: true } })).corps.actif, true);
  });

  it('refuse d’archiver un rôle porté par des utilisateurs actifs (409)', async () => {
    erreur(await appel('PATCH', `/roles/${idRoleAgent}`, { jeton: jetonAdmin, corps: { actif: false } }), 409, 'role_utilise');
  });
});

describe('Utilisateurs et périmètre', () => {
  let jetonGestionnaire: string;
  let idGestionnaire: string;

  it('crée un utilisateur et contrôle les données saisies', async () => {
    const role = await appel('POST', '/roles', {
      jeton: jetonAdmin,
      corps: {
        code: `test_${suffixe}_gestionnaire`,
        nom: 'Gestionnaire des comptes de production',
        permissions: [
          { module: 'utilisateurs', action: 'consultation' },
          { module: 'utilisateurs', action: 'administration' },
        ],
      },
    });
    assert.equal(role.statut, 201);

    const email = `test.gestionnaire.${suffixe}@riz-de-niono.test`;
    const corps = {
      nom: 'Gestionnaire production',
      email,
      mot_de_passe: MOT_DE_PASSE_TEMPORAIRE,
      role_id: role.corps._id,
      activites: ['production'],
    };
    const creation = await appel('POST', '/utilisateurs', { jeton: jetonAdmin, corps });
    assert.equal(creation.statut, 201, JSON.stringify(creation.corps));
    assert.deepEqual(creation.corps.activites, ['production']);
    assert.equal(creation.corps.mot_de_passe_hash, undefined);
    idGestionnaire = creation.corps._id;

    erreur(
      await appel('POST', '/utilisateurs', { jeton: jetonAdmin, corps: { ...corps, email: email.toUpperCase() } }),
      409,
      'email_deja_utilise',
    );
    erreur(
      await appel('POST', '/utilisateurs', {
        jeton: jetonAdmin,
        corps: { ...corps, email: `test.court.${suffixe}@riz-de-niono.test`, mot_de_passe: 'court' },
      }),
      422,
      'mot_de_passe_trop_court',
    );
    erreur(
      await appel('POST', '/utilisateurs', {
        jeton: jetonAdmin,
        corps: {
          ...corps,
          email: `test.sites.${suffixe}@riz-de-niono.test`,
          activites: ['transformation'],
          site_ids: ['64b000000000000000000001'],
        },
      }),
      422,
      'donnees_invalides',
    );
    erreur(
      await appel('POST', '/utilisateurs', {
        jeton: jetonAdmin,
        corps: { ...corps, email: `test.role.${suffixe}@riz-de-niono.test`, role_id: '000000000000000000000000' },
      }),
      422,
      'donnees_invalides',
    );

    const filtre = await appel('GET', `/utilisateurs?role_id=${role.corps._id}`, { jeton: jetonAdmin });
    assert.equal(filtre.corps.total, 1);
    assert.equal((await appel('GET', `/utilisateurs/${idGestionnaire}`, { jeton: jetonAdmin })).corps.email, email);
  });

  it('limite un gestionnaire à son périmètre d’activités', async () => {
    jetonGestionnaire = await connecter(`test.gestionnaire.${suffixe}@riz-de-niono.test`, MOT_DE_PASSE_TEMPORAIRE);

    erreur(
      await appel('POST', '/utilisateurs', {
        jeton: jetonGestionnaire,
        corps: {
          nom: 'Hors périmètre',
          email: `test.hors.${suffixe}@riz-de-niono.test`,
          mot_de_passe: MOT_DE_PASSE_TEMPORAIRE,
          role_id: idRoleAgent,
          activites: ['commercialisation'],
        },
      }),
      403,
      'acces_refuse',
    );
    const dansPerimetre = await appel('POST', '/utilisateurs', {
      jeton: jetonGestionnaire,
      corps: {
        nom: 'Dans le périmètre',
        email: `test.dans.${suffixe}@riz-de-niono.test`,
        mot_de_passe: MOT_DE_PASSE_TEMPORAIRE,
        role_id: idRoleAgent,
        activites: ['production'],
      },
    });
    assert.equal(dansPerimetre.statut, 201, JSON.stringify(dansPerimetre.corps));

    const liste = await appel('GET', '/utilisateurs?taille_page=100', { jeton: jetonGestionnaire });
    assert.equal(liste.statut, 200);
    assert.ok(liste.corps.items.length > 0);
    for (const utilisateur of liste.corps.items) {
      assert.ok(utilisateur.activites.every((activite: string) => activite === 'production'));
    }
    assert.ok(!liste.corps.items.some((utilisateur: { _id: string }) => utilisateur._id === idAdmin));
    erreur(await appel('GET', `/utilisateurs/${idAdmin}`, { jeton: jetonGestionnaire }), 404, 'ressource_introuvable');
    erreur(
      await appel('PATCH', `/utilisateurs/${dansPerimetre.corps._id}`, {
        jeton: jetonGestionnaire,
        corps: { activites: ['production', 'transformation'] },
      }),
      403,
      'acces_refuse',
    );
  });

  it('interdit de modifier son propre rôle, périmètre ou activation (409)', async () => {
    erreur(
      await appel('PATCH', `/utilisateurs/${idGestionnaire}`, { jeton: jetonGestionnaire, corps: { role_id: idRoleAgent } }),
      409,
      'modification_propre_compte',
    );
    erreur(
      await appel('PATCH', `/utilisateurs/${idAdmin}`, { jeton: jetonAdmin, corps: { actif: false } }),
      409,
      'modification_propre_compte',
    );
  });

  it('désactive un compte : ses sessions sont révoquées et la connexion est refusée', async () => {
    const { id, email } = await creerUtilisateurTemporaire('desactive');
    const jeton = await connecter(email, MOT_DE_PASSE_TEMPORAIRE);

    const desactivation = await appel('PATCH', `/utilisateurs/${id}`, { jeton: jetonAdmin, corps: { actif: false } });
    assert.equal(desactivation.statut, 200);
    assert.equal(desactivation.corps.actif, false);
    erreur(await appel('GET', '/profil', { jeton }), 401, 'session_invalide');
    erreur(
      await appel('POST', '/auth/connexion', { corps: { email, mot_de_passe: MOT_DE_PASSE_TEMPORAIRE } }),
      403,
      'compte_inactif',
    );

    assert.equal((await appel('PATCH', `/utilisateurs/${id}`, { jeton: jetonAdmin, corps: { actif: true } })).corps.actif, true);
    await connecter(email, MOT_DE_PASSE_TEMPORAIRE);
  });
});

describe('Profil utilisateur', () => {
  it('modifie le nom du profil', async () => {
    const { email } = await creerUtilisateurTemporaire('profil');
    const jeton = await connecter(email, MOT_DE_PASSE_TEMPORAIRE);
    const reponse = await appel('PATCH', '/profil', { jeton, corps: { nom: 'Nom modifié' } });
    assert.equal(reponse.statut, 200);
    assert.equal(reponse.corps.nom, 'Nom modifié');
    assert.equal((await appel('GET', '/profil', { jeton })).corps.nom, 'Nom modifié');
  });

  it('change le mot de passe : garde la session courante et révoque les autres', async () => {
    const { email } = await creerUtilisateurTemporaire('mdp');
    const jetonCourant = await connecter(email, MOT_DE_PASSE_TEMPORAIRE);
    const autreJeton = await connecter(email, MOT_DE_PASSE_TEMPORAIRE);
    const nouveau = 'Nouveau-mot-2026!';

    erreur(
      await appel('POST', '/profil/mot-de-passe', {
        jeton: jetonCourant,
        corps: { mot_de_passe_actuel: 'incorrect', nouveau_mot_de_passe: nouveau },
      }),
      422,
      'mot_de_passe_incorrect',
    );
    const changement = await appel('POST', '/profil/mot-de-passe', {
      jeton: jetonCourant,
      corps: { mot_de_passe_actuel: MOT_DE_PASSE_TEMPORAIRE, nouveau_mot_de_passe: nouveau },
    });
    assert.equal(changement.statut, 204);

    assert.equal((await appel('GET', '/profil', { jeton: jetonCourant })).statut, 200);
    erreur(await appel('GET', '/profil', { jeton: autreJeton }), 401, 'session_invalide');
    erreur(
      await appel('POST', '/auth/connexion', { corps: { email, mot_de_passe: MOT_DE_PASSE_TEMPORAIRE } }),
      401,
      'identifiants_invalides',
    );
    await connecter(email, nouveau);
  });
});

describe('Déconnexion', () => {
  it('révoque la session courante (204) puis la refuse (401)', async () => {
    const jeton = await connecter(limite.email, limite.mot_de_passe);
    assert.equal((await appel('POST', '/auth/deconnexion', { jeton })).statut, 204);
    erreur(await appel('GET', '/profil', { jeton }), 401, 'session_invalide');
    // Les autres sessions du même compte restent ouvertes.
    assert.equal((await appel('GET', '/profil', { jeton: jetonLimite })).statut, 200);
  });
});

describe('Réinitialisation du mot de passe', () => {
  it('répond 202 sans transmettre de lien pour une adresse inconnue', async () => {
    const email = `inconnu.${suffixe}@riz-de-niono.test`;
    assert.equal((await appel('POST', '/auth/reinitialisation', { corps: { email } })).statut, 202);
    await attendreTraitements();
    assert.equal(liensReinitialisation.has(email), false);
  });

  it('envoie réellement l’e-mail via Resend à une adresse de test et le lien reçu fonctionne', async () => {
    const email = `delivered+reinit-${suffixe}@resend.dev`;
    await creerUtilisateurTemporaire('resend', email);

    assert.equal((await appel('POST', '/auth/reinitialisation', { corps: { email } })).statut, 202);
    await attendreTraitements();
    assert.match(envoisReels.get(email) ?? '', /^[0-9a-f-]{36}$/, 'identifiant de message Resend attendu');

    const lien = new URL(liensReinitialisation.get(email)!);
    assert.equal(`${lien.origin}${lien.pathname}`, `${configuration.urlFrontend}/reinitialiser-mot-de-passe`);
    const nouveau = 'Via-Resend-2026!';
    const confirmation = await appel('POST', '/auth/reinitialisation/confirmation', {
      corps: { jeton: lien.searchParams.get('jeton'), nouveau_mot_de_passe: nouveau },
    });
    assert.equal(confirmation.statut, 204);
    await connecter(email, nouveau);
  });

  it('consomme un jeton unique, change le mot de passe et révoque les sessions', async () => {
    const { email } = await creerUtilisateurTemporaire('reinit');
    const sessionOuverte = await connecter(email, MOT_DE_PASSE_TEMPORAIRE);
    const jetonDe = (lien: string) => new URL(lien).searchParams.get('jeton')!;

    assert.equal((await appel('POST', '/auth/reinitialisation', { corps: { email } })).statut, 202);
    await attendreTraitements();
    const premierJeton = jetonDe(liensReinitialisation.get(email)!);
    // Une nouvelle demande remplace le jeton précédent.
    assert.equal((await appel('POST', '/auth/reinitialisation', { corps: { email } })).statut, 202);
    await attendreTraitements();
    const jeton = jetonDe(liensReinitialisation.get(email)!);
    assert.notEqual(jeton, premierJeton);

    const nouveau = 'Reinitialise-2026!';
    erreur(
      await appel('POST', '/auth/reinitialisation/confirmation', { corps: { jeton: premierJeton, nouveau_mot_de_passe: nouveau } }),
      422,
      'jeton_invalide',
    );
    erreur(
      await appel('POST', '/auth/reinitialisation/confirmation', { corps: { jeton, nouveau_mot_de_passe: 'court' } }),
      422,
      'mot_de_passe_trop_court',
    );
    assert.equal(
      (await appel('POST', '/auth/reinitialisation/confirmation', { corps: { jeton, nouveau_mot_de_passe: nouveau } })).statut,
      204,
    );
    erreur(
      await appel('POST', '/auth/reinitialisation/confirmation', { corps: { jeton, nouveau_mot_de_passe: nouveau } }),
      422,
      'jeton_invalide',
    );

    erreur(await appel('GET', '/profil', { jeton: sessionOuverte }), 401, 'session_invalide');
    erreur(
      await appel('POST', '/auth/connexion', { corps: { email, mot_de_passe: MOT_DE_PASSE_TEMPORAIRE } }),
      401,
      'identifiants_invalides',
    );
    await connecter(email, nouveau);
  });
});
