/**
 * Tests d'intégration des modules Sites de production, Campagnes agricoles, Catégories de produits,
 * Produits, Types d'opérations agricoles et Équipes de production, sur la base Atlas de tests.
 * Les données créées portent le préfixe « TST-<suffixe> » (ou « test. » / « test_ ») et sont supprimées à la fin.
 * Utilisation : npm run test:referentiels
 */
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import mongoose from 'mongoose';

import { creerApplication } from '../src/app.js';
import { configuration } from '../src/config/configuration.js';
import { connecterMongo, deconnecterMongo } from '../src/database/connexionMongo.js';
import { initialiserComptesTests } from '../src/database/comptesTests.js';

interface Reponse {
  statut: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  corps: any;
}

const suffixe = Date.now().toString(36).toUpperCase();
const prefixe = `TST-${suffixe}`;
const MOT_DE_PASSE = 'Referentiels-2026!';
const INCONNU = '000000000000000000000000';

let serveur: Server;
let urlApi: string;
let jetonAdmin: string;
let jetonAgent: string;
let jetonLimiteSiteA: string;
let jetonTransformation: string;
let idAdmin: string;
let idRoleProduction: string;
let idSiteA: string;
let idSiteB: string;
let idCategorie: string;

async function appel(methode: string, chemin: string, jeton?: string, corps?: unknown): Promise<Reponse> {
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

function attendu(reponse: Reponse, statut: number, code?: string): Reponse {
  assert.equal(reponse.statut, statut, JSON.stringify(reponse.corps));
  if (code) assert.equal(reponse.corps?.erreur?.code, code);
  return reponse;
}

async function connecter(email: string, motDePasse: string): Promise<{ jeton: string; id: string }> {
  const reponse = attendu(await appel('POST', '/auth/connexion', undefined, { email, mot_de_passe: motDePasse }), 200);
  return { jeton: reponse.corps.jeton, id: reponse.corps.profil._id };
}

async function creerCompte(nom: string, activites: string[], site_ids: string[] = []): Promise<string> {
  const email = `test.${nom}.${suffixe.toLowerCase()}@riz-de-niono.test`;
  attendu(
    await appel('POST', '/utilisateurs', jetonAdmin, {
      nom: `Test ${nom}`,
      email,
      mot_de_passe: MOT_DE_PASSE,
      role_id: idRoleProduction,
      activites,
      site_ids,
    }),
    201,
  );
  return (await connecter(email, MOT_DE_PASSE)).jeton;
}

const ids = (reponse: Reponse) => reponse.corps.items.map((element: { _id: string }) => element._id);

before(async () => {
  await connecterMongo(configuration.mongodbBaseTests);
  const { administrateur, limite } = await initialiserComptesTests();
  serveur = creerApplication().listen(0);
  urlApi = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}/api/v1`;

  ({ jeton: jetonAdmin, id: idAdmin } = await connecter(administrateur.email, administrateur.mot_de_passe));
  ({ jeton: jetonAgent } = await connecter(limite.email, limite.mot_de_passe));

  const permissions = [
    ...['sites_production', 'campagnes_agricoles', 'produits', 'types_operations_agricoles', 'equipes_production'].flatMap(
      (module) => ['consultation', 'saisie'].map((action) => ({ module, action })),
    ),
    { module: 'campagnes_agricoles', action: 'validation' },
    { module: 'campagnes_agricoles', action: 'cloture' },
    { module: 'categories_produits', action: 'consultation' },
    { module: 'utilisateurs', action: 'consultation' },
    { module: 'utilisateurs', action: 'administration' },
  ];
  const role = attendu(
    await appel('POST', '/roles', jetonAdmin, { code: `test_${suffixe.toLowerCase()}_prod`, nom: 'Production test', permissions }),
    201,
  );
  idRoleProduction = role.corps._id;
});

after(async () => {
  serveur?.close();
  const base = mongoose.connection.db;
  if (!base) return; // Connexion jamais établie : rien à nettoyer.
  const motif = { $regex: `^${prefixe}` };
  const documents: unknown[] = [];
  for (const collection of ['categories_produits', 'produits', 'sites_production', 'campagnes_agricoles', 'types_operations_agricoles']) {
    documents.push(...(await base.collection(collection).find({ code: motif }, { projection: { _id: 1 } }).toArray()).map((d) => d._id));
    await base.collection(collection).deleteMany({ code: motif });
  }
  documents.push(...(await base.collection('equipes_production').find({ nom: motif }, { projection: { _id: 1 } }).toArray()).map((d) => d._id));
  await base.collection('equipes_production').deleteMany({ nom: motif });

  const utilisateurs = (await base.collection('utilisateurs').find({ email: { $regex: '^test\\.' } }, { projection: { _id: 1 } }).toArray()).map(
    (d) => d._id,
  );
  const roles = (await base.collection('roles').find({ code: { $regex: '^test_' } }, { projection: { _id: 1 } }).toArray()).map((d) => d._id);
  await base.collection('sessions').deleteMany({ utilisateur_id: { $in: utilisateurs } });
  await base.collection('journal_operations').deleteMany({ document_id: { $in: [...documents, ...utilisateurs, ...roles] } });
  await base.collection('utilisateurs').deleteMany({ _id: { $in: utilisateurs } });
  await base.collection('roles').deleteMany({ _id: { $in: roles } });
  await deconnecterMongo();
});

describe('Contrôle des accès communs', () => {
  it('refuse les six modules sans session (401) et une saisie sans permission (403)', async () => {
    for (const chemin of [
      '/sites-production',
      '/campagnes-agricoles',
      '/categories-produits',
      '/produits',
      '/types-operations-agricoles',
      '/equipes-production',
    ]) {
      attendu(await appel('GET', chemin), 401, 'session_invalide');
    }
    attendu(await appel('POST', '/categories-produits', jetonAgent, { code: `${prefixe}-X`, nom: 'X' }), 403, 'acces_refuse');
    attendu(await appel('POST', '/sites-production', jetonAgent, { code: `${prefixe}-X`, nom: 'X' }), 403, 'acces_refuse');
  });
});

describe('Catégories de produits', () => {
  it('crée (code normalisé), refuse un doublon, liste, consulte et archive', async () => {
    const creation = attendu(await appel('POST', '/categories-produits', jetonAdmin, { code: `${prefixe}-cat`.toLowerCase(), nom: 'Semences' }), 201);
    assert.equal(creation.corps.code, `${prefixe}-CAT`);
    idCategorie = creation.corps._id;
    attendu(await appel('POST', '/categories-produits', jetonAdmin, { code: `${prefixe}-CAT`, nom: 'Doublon' }), 409, 'code_deja_utilise');
    attendu(await appel('POST', '/categories-produits', jetonAdmin, { code: 'code invalide !', nom: 'X' }), 422, 'donnees_invalides');

    assert.ok(ids(attendu(await appel('GET', '/categories-produits?actif=true&taille_page=100', jetonAdmin), 200)).includes(idCategorie));
    assert.equal(attendu(await appel('GET', `/categories-produits/${idCategorie}`, jetonAgent), 200).corps.nom, 'Semences');

    const archivee = attendu(await appel('POST', '/categories-produits', jetonAdmin, { code: `${prefixe}-ARCH`, nom: 'Archivée' }), 201);
    assert.equal(attendu(await appel('PATCH', `/categories-produits/${archivee.corps._id}`, jetonAdmin, { actif: false }), 200).corps.actif, false);
    attendu(await appel('GET', `/categories-produits/${INCONNU}`, jetonAdmin), 404, 'ressource_introuvable');
  });

  it('propose un code à partir du nom et garantit son unicité lors de créations simultanées', async () => {
    const nom = `${prefixe} Engrais de fond`;
    const proposition = attendu(await appel('GET', `/categories-produits/code-propose?nom=${encodeURIComponent(nom)}`, jetonAdmin), 200);
    assert.equal(proposition.corps.code, `${prefixe}-ENGRAIS-FOND`);

    const creations = await Promise.all(
      Array.from({ length: 4 }, () => appel('POST', '/categories-produits', jetonAdmin, { nom })),
    );
    const codes = creations.map((creation) => attendu(creation, 201).corps.code as string);
    assert.equal(new Set(codes).size, 4);
    assert.ok(codes.includes(`${prefixe}-ENGRAIS-FOND`));
    assert.ok(codes.includes(`${prefixe}-ENGRAIS-FOND-4`));

    const suivante = attendu(await appel('GET', `/categories-produits/code-propose?nom=${encodeURIComponent(nom)}`, jetonAdmin), 200);
    assert.equal(suivante.corps.code, `${prefixe}-ENGRAIS-FOND-5`);
    attendu(await appel('GET', '/categories-produits/code-propose?nom=X', jetonAgent), 403, 'acces_refuse');
  });
});

describe('Types d’opérations agricoles et équipes de production', () => {
  it('gère le référentiel des travaux', async () => {
    const creation = attendu(await appel('POST', '/types-operations-agricoles', jetonAdmin, { code: `${prefixe}-SEMIS`, nom: 'Semis' }), 201);
    const id = creation.corps._id;
    attendu(await appel('POST', '/types-operations-agricoles', jetonAdmin, { code: `${prefixe}-SEMIS`, nom: 'Semis' }), 409, 'code_deja_utilise');
    assert.equal(attendu(await appel('PATCH', `/types-operations-agricoles/${id}`, jetonAdmin, { nom: 'Semis direct' }), 200).corps.nom, 'Semis direct');
    assert.equal(attendu(await appel('PATCH', `/types-operations-agricoles/${id}`, jetonAdmin, { actif: false }), 200).corps.actif, false);
    assert.ok(ids(attendu(await appel('GET', '/types-operations-agricoles?actif=false&taille_page=100', jetonAdmin), 200)).includes(id));
    assert.equal(attendu(await appel('GET', `/types-operations-agricoles/${id}`, jetonAdmin), 200).corps.code, `${prefixe}-SEMIS`);
  });

  it('gère les équipes et leurs membres', async () => {
    const creation = attendu(
      await appel('POST', '/equipes-production', jetonAdmin, { nom: `${prefixe} Équipe Nord`, membres: ['Awa', ' Moussa ', 'Awa'] }),
      201,
    );
    assert.deepEqual(creation.corps.membres, ['Awa', 'Moussa']);
    const id = creation.corps._id;
    attendu(await appel('POST', '/equipes-production', jetonAdmin, { nom: `${prefixe} X`, membres: [''] }), 422, 'donnees_invalides');
    const modification = attendu(await appel('PATCH', `/equipes-production/${id}`, jetonAdmin, { membres: ['Awa', 'Fatou'], actif: false }), 200);
    assert.deepEqual(modification.corps.membres, ['Awa', 'Fatou']);
    assert.equal(modification.corps.actif, false);
    assert.ok(ids(attendu(await appel('GET', '/equipes-production?taille_page=100', jetonAdmin), 200)).includes(id));
    assert.equal(attendu(await appel('GET', `/equipes-production/${id}`, jetonAdmin), 200).corps.nom, `${prefixe} Équipe Nord`);
  });
});

describe('Sites de production', () => {
  it('crée des sites avec superficie décimale et responsable, et contrôle les données', async () => {
    const siteA = attendu(
      await appel('POST', '/sites-production', jetonAdmin, {
        code: `${prefixe}-A`,
        nom: 'Site A',
        localisation: 'Niono',
        superficie_ha: '12.5',
        responsable_id: idAdmin,
      }),
      201,
    );
    assert.equal(siteA.corps.superficie_ha, '12.5');
    assert.equal(siteA.corps.responsable_id, idAdmin);
    idSiteA = siteA.corps._id;
    idSiteB = attendu(await appel('POST', '/sites-production', jetonAdmin, { code: `${prefixe}-B`, nom: 'Site B' }), 201).corps._id;

    attendu(await appel('POST', '/sites-production', jetonAdmin, { code: `${prefixe}-C`, nom: 'C', superficie_ha: 12.5 }), 422, 'donnees_invalides');
    attendu(await appel('POST', '/sites-production', jetonAdmin, { code: `${prefixe}-C`, nom: 'C', responsable_id: INCONNU }), 422, 'donnees_invalides');
    attendu(await appel('POST', '/sites-production', jetonAdmin, { code: `${prefixe}-A`, nom: 'Doublon' }), 409, 'code_deja_utilise');

    const modification = attendu(await appel('PATCH', `/sites-production/${idSiteA}`, jetonAdmin, { localisation: null, superficie_ha: '13' }), 200);
    assert.equal(modification.corps.localisation, null);
    assert.equal(modification.corps.superficie_ha, '13');
    const liste = attendu(await appel('GET', '/sites-production?actif=true&taille_page=100', jetonAdmin), 200);
    assert.ok(ids(liste).includes(idSiteA) && ids(liste).includes(idSiteB));
  });

  it('valide les site_ids attribués aux utilisateurs (existence et périmètre du gestionnaire)', async () => {
    attendu(
      await appel('POST', '/utilisateurs', jetonAdmin, {
        nom: 'Site inconnu',
        email: `test.inconnu.${suffixe.toLowerCase()}@riz-de-niono.test`,
        mot_de_passe: MOT_DE_PASSE,
        role_id: idRoleProduction,
        activites: ['production'],
        site_ids: [INCONNU],
      }),
      422,
      'donnees_invalides',
    );

    jetonLimiteSiteA = await creerCompte('site-a', ['production'], [idSiteA]);
    const nouveau = (nom: string, site_ids: string[]) => ({
      nom,
      email: `test.${nom}.${suffixe.toLowerCase()}@riz-de-niono.test`,
      mot_de_passe: MOT_DE_PASSE,
      role_id: idRoleProduction,
      activites: ['production'],
      site_ids,
    });
    // Liste vide = tous les sites : refusée à un gestionnaire limité au site A.
    attendu(await appel('POST', '/utilisateurs', jetonLimiteSiteA, nouveau('tous-sites', [])), 403, 'acces_refuse');
    attendu(await appel('POST', '/utilisateurs', jetonLimiteSiteA, nouveau('site-b', [idSiteB])), 403, 'acces_refuse');
    attendu(await appel('POST', '/utilisateurs', jetonLimiteSiteA, nouveau('site-a-bis', [idSiteA])), 201);
  });

  it('limite un utilisateur à ses sites et lui interdit d’en créer', async () => {
    const liste = attendu(await appel('GET', '/sites-production?taille_page=100', jetonLimiteSiteA), 200);
    assert.deepEqual(ids(liste), [idSiteA]);
    attendu(await appel('GET', `/sites-production/${idSiteB}`, jetonLimiteSiteA), 404, 'ressource_introuvable');
    attendu(await appel('PATCH', `/sites-production/${idSiteB}`, jetonLimiteSiteA, { nom: 'X' }), 404, 'ressource_introuvable');
    assert.equal(attendu(await appel('PATCH', `/sites-production/${idSiteA}`, jetonLimiteSiteA, { nom: 'Site A renommé' }), 200).corps.nom, 'Site A renommé');
    attendu(await appel('POST', '/sites-production', jetonLimiteSiteA, { code: `${prefixe}-D`, nom: 'D' }), 403, 'acces_refuse');
  });

  it('refuse les modules de production à un utilisateur hors de l’activité', async () => {
    jetonTransformation = await creerCompte('transfo', ['transformation']);
    for (const chemin of ['/sites-production', '/campagnes-agricoles', '/types-operations-agricoles', '/equipes-production']) {
      attendu(await appel('GET', chemin, jetonTransformation), 403, 'acces_refuse');
    }
  });
});

describe('Campagnes agricoles', () => {
  let idCampagne: string;

  it('crée une campagne, contrôle dates et sites, puis associe des sites', async () => {
    const base = { nom: 'Hivernage 2026', date_debut: '2026-06-01', date_fin: '2026-11-30' };
    attendu(await appel('POST', '/campagnes-agricoles', jetonAdmin, { ...base, code: `${prefixe}-X`, date_fin: '2026-05-01' }), 422, 'donnees_invalides');
    attendu(await appel('POST', '/campagnes-agricoles', jetonAdmin, { ...base, code: `${prefixe}-X`, site_ids: [INCONNU] }), 422, 'donnees_invalides');

    const creation = attendu(await appel('POST', '/campagnes-agricoles', jetonAdmin, { ...base, code: `${prefixe}-HIV`, site_ids: [idSiteA] }), 201);
    assert.equal(creation.corps.statut, 'brouillon');
    assert.equal(creation.corps.date_debut, '2026-06-01T00:00:00.000Z');
    idCampagne = creation.corps._id;
    attendu(await appel('POST', '/campagnes-agricoles', jetonAdmin, { ...base, code: `${prefixe}-HIV` }), 409, 'code_deja_utilise');

    const association = attendu(await appel('PATCH', `/campagnes-agricoles/${idCampagne}`, jetonAdmin, { site_ids: [idSiteA, idSiteB] }), 200);
    assert.deepEqual(association.corps.site_ids, [idSiteA, idSiteB]);

    const vide = attendu(await appel('POST', '/campagnes-agricoles', jetonAdmin, { ...base, code: `${prefixe}-VIDE` }), 201);
    attendu(await appel('POST', `/campagnes-agricoles/${vide.corps._id}/ouverture`, jetonAdmin), 422, 'campagne_incomplete');
  });

  it('supprime uniquement les brouillons autorisés et les retire de la liste', async () => {
    const brouillon = attendu(await appel('POST', '/campagnes-agricoles', jetonAdmin, {
      code: `${prefixe}-SUP`,
      nom: 'Brouillon à retirer',
      date_debut: '2026-06-01',
      date_fin: '2026-10-01',
      site_ids: [idSiteA, idSiteB],
    }), 201);
    const chemin = `/campagnes-agricoles/${brouillon.corps._id}`;
    attendu(await appel('DELETE', chemin, jetonLimiteSiteA), 403, 'acces_refuse');
    attendu(await appel('DELETE', chemin, jetonAdmin), 204);
    attendu(await appel('GET', chemin, jetonAdmin), 404, 'ressource_introuvable');
    attendu(await appel('POST', `${chemin}/ouverture`, jetonAdmin), 404, 'ressource_introuvable');
    const visibles = ids(attendu(await appel('GET', '/campagnes-agricoles?statut=brouillon&taille_page=100', jetonAdmin), 200));
    assert.ok(!visibles.includes(brouillon.corps._id));
  });

  it('ouvre puis clôture la campagne en appliquant les règles de chaque statut', async () => {
    attendu(await appel('POST', `/campagnes-agricoles/${idCampagne}/cloture`, jetonAdmin), 409, 'transition_invalide');
    attendu(await appel('POST', `/campagnes-agricoles/${idCampagne}/ouverture`, jetonAgent), 403, 'acces_refuse');

    assert.equal(attendu(await appel('POST', `/campagnes-agricoles/${idCampagne}/ouverture`, jetonAdmin), 200).corps.statut, 'ouverte');
    assert.equal(attendu(await appel('POST', `/campagnes-agricoles/${idCampagne}/ouverture`, jetonAdmin), 200).corps.statut, 'ouverte');

    attendu(await appel('DELETE', `/campagnes-agricoles/${idCampagne}`, jetonAdmin), 409, 'campagne_non_brouillon');
    attendu(await appel('PATCH', `/campagnes-agricoles/${idCampagne}`, jetonAdmin, { code: `${prefixe}-AUTRE` }), 409, 'modification_interdite');
    attendu(await appel('PATCH', `/campagnes-agricoles/${idCampagne}`, jetonAdmin, { site_ids: [idSiteB] }), 409, 'retrait_site_interdit');
    const modification = attendu(
      await appel('PATCH', `/campagnes-agricoles/${idCampagne}`, jetonAdmin, { nom: 'Hivernage 2026 prolongé', date_fin: '2026-12-15' }),
      200,
    );
    assert.equal(modification.corps.nom, 'Hivernage 2026 prolongé');

    assert.equal(attendu(await appel('POST', `/campagnes-agricoles/${idCampagne}/cloture`, jetonAdmin), 200).corps.statut, 'cloturee');
    assert.equal(attendu(await appel('POST', `/campagnes-agricoles/${idCampagne}/cloture`, jetonAdmin), 200).corps.statut, 'cloturee');
    attendu(await appel('PATCH', `/campagnes-agricoles/${idCampagne}`, jetonAdmin, { nom: 'X' }), 409, 'campagne_cloturee');
    attendu(await appel('POST', `/campagnes-agricoles/${idCampagne}/ouverture`, jetonAdmin), 409, 'transition_invalide');

    const cloturees = attendu(await appel('GET', '/campagnes-agricoles?statut=cloturee&taille_page=100', jetonAdmin), 200);
    assert.ok(ids(cloturees).includes(idCampagne));
    assert.equal(attendu(await appel('GET', `/campagnes-agricoles/${idCampagne}`, jetonAgent), 200).corps.statut, 'cloturee');
  });

  it('applique le périmètre par site aux campagnes', async () => {
    const base = { nom: 'Contre-saison', date_debut: '2027-01-10', date_fin: '2027-05-30' };
    const campagneB = attendu(await appel('POST', '/campagnes-agricoles', jetonAdmin, { ...base, code: `${prefixe}-CSB`, site_ids: [idSiteB] }), 201);
    const campagneAB = attendu(await appel('POST', '/campagnes-agricoles', jetonAdmin, { ...base, code: `${prefixe}-CSAB`, site_ids: [idSiteA, idSiteB] }), 201);

    const visibles = ids(attendu(await appel('GET', '/campagnes-agricoles?taille_page=100', jetonLimiteSiteA), 200));
    assert.ok(!visibles.includes(campagneB.corps._id));
    assert.ok(visibles.includes(campagneAB.corps._id));
    attendu(await appel('GET', `/campagnes-agricoles/${campagneB.corps._id}`, jetonLimiteSiteA), 404, 'ressource_introuvable');
    attendu(await appel('PATCH', `/campagnes-agricoles/${campagneAB.corps._id}`, jetonLimiteSiteA, { nom: 'X' }), 403, 'acces_refuse');
    attendu(await appel('POST', `/campagnes-agricoles/${campagneAB.corps._id}/ouverture`, jetonLimiteSiteA), 403, 'acces_refuse');
    attendu(await appel('POST', '/campagnes-agricoles', jetonLimiteSiteA, { ...base, code: `${prefixe}-CSX` }), 403, 'acces_refuse');

    const campagneA = attendu(await appel('POST', '/campagnes-agricoles', jetonLimiteSiteA, { ...base, code: `${prefixe}-CSA`, site_ids: [idSiteA] }), 201);
    assert.equal(attendu(await appel('POST', `/campagnes-agricoles/${campagneA.corps._id}/ouverture`, jetonLimiteSiteA), 200).corps.statut, 'ouverte');
  });
});

describe('Produits', () => {
  let idProduitPartage: string;

  it('partage un produit entre plusieurs activités', async () => {
    const creation = attendu(
      await appel('POST', '/produits', jetonAdmin, {
        code: `${prefixe}-PADDY`,
        nom: 'Paddy',
        categorie_id: idCategorie,
        unite_stock: 'kg',
        activites: ['production', 'commercialisation'],
        prix_vente: '250',
      }),
      201,
    );
    assert.deepEqual(creation.corps.activites, ['production', 'commercialisation']);
    assert.equal(creation.corps.prix_vente, '250');
    assert.equal(creation.corps.stockable, true);
    idProduitPartage = creation.corps._id;

    for (const activite of ['production', 'commercialisation']) {
      const liste = attendu(await appel('GET', `/produits?activite=${activite}&taille_page=100`, jetonAdmin), 200);
      assert.ok(ids(liste).includes(idProduitPartage), activite);
    }
    const parCategorie = attendu(await appel('GET', `/produits?categorie_id=${idCategorie}`, jetonAdmin), 200);
    assert.ok(ids(parCategorie).includes(idProduitPartage));
    assert.equal(attendu(await appel('GET', `/produits/${idProduitPartage}`, jetonAgent), 200).corps.code, `${prefixe}-PADDY`);
  });

  it('contrôle les données d’un produit', async () => {
    const base = { code: `${prefixe}-ERR`, nom: 'Erreur', categorie_id: idCategorie, unite_stock: 'kg' };
    attendu(await appel('POST', '/produits', jetonAdmin, { ...base, activites: [] }), 422, 'donnees_invalides');
    attendu(await appel('POST', '/produits', jetonAdmin, { ...base, activites: ['production'], categorie_id: INCONNU }), 422, 'donnees_invalides');
    attendu(await appel('POST', '/produits', jetonAdmin, { ...base, activites: ['production'], prix_vente: '-5' }), 422, 'donnees_invalides');
    attendu(await appel('POST', '/produits', jetonAdmin, { ...base, code: `${prefixe}-PADDY`, activites: ['production'] }), 409, 'code_deja_utilise');
    const sansPrix = attendu(await appel('PATCH', `/produits/${idProduitPartage}`, jetonAdmin, { prix_vente: null, nom: 'Paddy brut' }), 200);
    assert.equal(sansPrix.corps.prix_vente, null);
  });

  it('limite la visibilité et la modification des usages au périmètre d’activités', async () => {
    // Utilisateur Transformation : ne voit pas un produit qui ne sert pas à son activité.
    assert.ok(!ids(attendu(await appel('GET', '/produits?taille_page=100', jetonTransformation), 200)).includes(idProduitPartage));
    attendu(await appel('GET', `/produits/${idProduitPartage}`, jetonTransformation), 404, 'ressource_introuvable');
    attendu(await appel('GET', '/produits?activite=production', jetonTransformation), 403, 'acces_refuse');
    attendu(
      await appel('POST', '/produits', jetonTransformation, {
        code: `${prefixe}-RIZ`,
        nom: 'Riz blanc',
        categorie_id: idCategorie,
        unite_stock: 'sac',
        activites: ['commercialisation'],
      }),
      403,
      'acces_refuse',
    );
    const riz = attendu(
      await appel('POST', '/produits', jetonTransformation, {
        code: `${prefixe}-RIZ`,
        nom: 'Riz blanc',
        categorie_id: idCategorie,
        unite_stock: 'sac',
        activites: ['transformation'],
        stockable: true,
      }),
      201,
    );

    // Utilisateur Production : modifie le produit partagé mais pas les usages des autres activités.
    attendu(await appel('PATCH', `/produits/${idProduitPartage}`, jetonLimiteSiteA, { activites: ['production', 'commercialisation', 'transformation'] }), 403, 'acces_refuse');
    attendu(await appel('PATCH', `/produits/${idProduitPartage}`, jetonLimiteSiteA, { activites: ['production'] }), 403, 'acces_refuse');
    assert.equal(attendu(await appel('PATCH', `/produits/${idProduitPartage}`, jetonLimiteSiteA, { unite_stock: 'sac' }), 200).corps.unite_stock, 'sac');

    // Un administrateur partage ensuite le riz avec la commercialisation.
    const partage = attendu(await appel('PATCH', `/produits/${riz.corps._id}`, jetonAdmin, { activites: ['transformation', 'commercialisation'] }), 200);
    assert.deepEqual(partage.corps.activites, ['transformation', 'commercialisation']);
  });
});
