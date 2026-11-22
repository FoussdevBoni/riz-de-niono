/**
 * Tests d'intégration des modules Cultures, Productions, Opérations agricoles et Mouvements de stock,
 * sur la base Atlas de tests. Le stock initial d'intrants est préparé par une écriture manuelle
 * du service Stock (aucune route ne crée d'écriture manuelle dans le contrat).
 * Les données créées portent le préfixe « TST-<suffixe> » et sont supprimées à la fin.
 * Utilisation : npm run test:production-stock
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
import { authentificationService } from '../src/modules/authentification/services/authentificationService.js';
import { stockService } from '../src/modules/stock/services/stockService.js';

interface Reponse {
  statut: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  corps: any;
}

const suffixe = Date.now().toString(36).toUpperCase();
const prefixe = `TST-${suffixe}`;
const MOT_DE_PASSE = 'Production-Stock-2026!';

let serveur: Server;
let urlApi: string;
let jetonAdmin: string;
let jetonAgent: string;
let jetonSiteA: string;
let idAdmin: string;
const ref: Record<string, string> = {};

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

async function solde(produitId: string): Promise<number> {
  const reponse = attendu(await appel('GET', `/stock?produit_id=${produitId}`, jetonAdmin), 200);
  return reponse.corps.items.length === 0 ? 0 : Number(reponse.corps.items[0].quantite_disponible);
}

async function mouvementsDe(origineType: string, origineId: string, produitId: string) {
  const reponse = attendu(
    await appel('GET', `/mouvements-stock?produit_id=${produitId}&origine_type=${origineType}&origine_id=${origineId}&taille_page=100`, jetonAdmin),
    200,
  );
  assert.ok(reponse.corps.items.every((m: { origine_id: string }) => m.origine_id === origineId));
  return reponse.corps.items;
}

async function creerProduction(quantite: string, produit = ref.paddy, site = ref.siteA): Promise<string> {
  const reponse = attendu(
    await appel('POST', '/productions', jetonAdmin, {
      campagne_id: ref.campagne,
      site_id: site,
      produit_id: produit,
      date_recolte: '2026-10-20',
      superficie_recoltee_ha: '2.5',
      quantite,
    }),
    201,
  );
  return reponse.corps._id;
}

async function creerOperation(intrants: { produit_id: string; quantite: string }[]): Promise<Reponse> {
  return attendu(
    await appel('POST', '/operations-agricoles', jetonAdmin, {
      campagne_id: ref.campagne,
      site_id: ref.siteA,
      type_operation_id: ref.typeOperation,
      equipe_id: ref.equipe,
      date_operation: '2026-07-15',
      journees_travail: '2.5',
      cout_main_oeuvre: '15000',
      intrants,
    }),
    201,
  );
}

before(async () => {
  await connecterMongo(configuration.mongodbBaseTests);
  const { administrateur, limite } = await initialiserComptesTests();
  serveur = creerApplication().listen(0);
  urlApi = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}/api/v1`;
  ({ jeton: jetonAdmin, id: idAdmin } = await connecter(administrateur.email, administrateur.mot_de_passe));
  ({ jeton: jetonAgent } = await connecter(limite.email, limite.mot_de_passe));

  const creer = async (chemin: string, corps: unknown) => attendu(await appel('POST', chemin, jetonAdmin, corps), 201).corps._id as string;
  ref.categorie = await creer('/categories-produits', { code: `${prefixe}-CAT`, nom: 'Récoltes et intrants' });
  const produit = (code: string, nom: string, activites: string[], unite = 'kg') =>
    creer('/produits', { code: `${prefixe}-${code}`, nom, categorie_id: ref.categorie, unite_stock: unite, activites });
  ref.paddy = await produit('PADDY', 'Paddy', ['production', 'commercialisation']);
  ref.engrais = await produit('NPK', 'Engrais NPK', ['production'], 'sac');
  ref.son = await produit('SON', 'Son de riz', ['production']);
  ref.semence = await produit('SEM', 'Semence', ['production']);
  ref.siteA = await creer('/sites-production', { code: `${prefixe}-A`, nom: 'Site A', superficie_ha: '20' });
  ref.siteB = await creer('/sites-production', { code: `${prefixe}-B`, nom: 'Site B' });
  ref.siteHors = await creer('/sites-production', { code: `${prefixe}-H`, nom: 'Site hors campagne' });
  ref.campagne = await creer('/campagnes-agricoles', {
    code: `${prefixe}-HIV`,
    nom: 'Hivernage test',
    date_debut: '2026-06-01',
    date_fin: '2026-12-31',
    site_ids: [ref.siteA, ref.siteB],
  });
  ref.typeOperation = await creer('/types-operations-agricoles', { code: `${prefixe}-FERT`, nom: 'Fertilisation' });
  ref.equipe = await creer('/equipes-production', { nom: `${prefixe} Équipe`, membres: ['Awa', 'Moussa'] });

  const permissions = ['cultures', 'operations_agricoles', 'productions'].flatMap((module) =>
    ['consultation', 'saisie', 'validation'].map((action) => ({ module, action })),
  );
  const role = await creer('/roles', {
    code: `test_${suffixe.toLowerCase()}_terrain`,
    nom: 'Terrain test',
    permissions: [...permissions, { module: 'stock', action: 'consultation' }],
  });
  const email = `test.site-a.${suffixe.toLowerCase()}@riz-de-niono.test`;
  await creer('/utilisateurs', { nom: 'Test site A', email, mot_de_passe: MOT_DE_PASSE, role_id: role, activites: ['production'], site_ids: [ref.siteA] });
  ({ jeton: jetonSiteA } = await connecter(email, MOT_DE_PASSE));
});

after(async () => {
  serveur?.close();
  const base = mongoose.connection.db;
  if (!base) return;
  const motif = { $regex: `^${prefixe}` };
  const idsDe = async (collection: string, filtre: object) =>
    (await base.collection(collection).find(filtre, { projection: { _id: 1 } }).toArray()).map((d) => d._id);

  const campagnes = await idsDe('campagnes_agricoles', { code: motif });
  const produits = await idsDe('produits', { code: motif });
  const documents = [
    ...campagnes,
    ...produits,
    ...(await idsDe('productions', { campagne_id: { $in: campagnes } })),
    ...(await idsDe('operations_agricoles', { campagne_id: { $in: campagnes } })),
    ...(await idsDe('cultures', { campagne_id: { $in: campagnes } })),
    ...(await idsDe('mouvements_stock', { produit_id: { $in: produits } })),
  ];
  for (const collection of ['productions', 'operations_agricoles', 'cultures']) {
    await base.collection(collection).deleteMany({ campagne_id: { $in: campagnes } });
  }
  await base.collection('mouvements_stock').deleteMany({ produit_id: { $in: produits } });
  await base.collection('stocks').deleteMany({ produit_id: { $in: produits } });
  for (const collection of ['categories_produits', 'produits', 'sites_production', 'campagnes_agricoles', 'types_operations_agricoles']) {
    documents.push(...(await idsDe(collection, { code: motif })));
    await base.collection(collection).deleteMany({ code: motif });
  }
  documents.push(...(await idsDe('equipes_production', { nom: motif })));
  await base.collection('equipes_production').deleteMany({ nom: motif });
  const utilisateurs = await idsDe('utilisateurs', { email: { $regex: '^test\\.' } });
  const roles = await idsDe('roles', { code: { $regex: '^test_' } });
  await base.collection('sessions').deleteMany({ utilisateur_id: { $in: utilisateurs } });
  await base.collection('journal_operations').deleteMany({ document_id: { $in: [...documents, ...utilisateurs, ...roles] } });
  await base.collection('utilisateurs').deleteMany({ _id: { $in: utilisateurs } });
  await base.collection('roles').deleteMany({ _id: { $in: roles } });
  await deconnecterMongo();
});

describe('Cultures', () => {
  it('enregistre les cultures par site et campagne', async () => {
    const corps = { campagne_id: ref.campagne, site_id: ref.siteA, culture: 'Riz', variete: 'Gambiaka', superficie_ha: '8.5', date_semis: '2026-06-20' };
    const culture = attendu(await appel('POST', '/cultures', jetonAdmin, corps), 201);
    assert.equal(culture.corps.superficie_ha, '8.5');
    ref.culture = culture.corps._id;
    attendu(await appel('POST', '/cultures', jetonAdmin, { ...corps, site_id: ref.siteHors }), 422, 'site_hors_campagne');
    attendu(await appel('POST', '/cultures', jetonAdmin, { ...corps, superficie_ha: '0' }), 422, 'donnees_invalides');

    const modification = attendu(await appel('PATCH', `/cultures/${ref.culture}`, jetonAdmin, { variete: null, superficie_ha: '9' }), 200);
    assert.equal(modification.corps.variete, null);
    assert.equal(modification.corps.superficie_ha, '9');
    const liste = attendu(await appel('GET', `/cultures?campagne_id=${ref.campagne}&site_id=${ref.siteA}`, jetonAdmin), 200);
    assert.deepEqual(liste.corps.items.map((c: { _id: string }) => c._id), [ref.culture]);
    assert.equal(attendu(await appel('GET', `/cultures/${ref.culture}`, jetonSiteA), 200).corps.culture, 'Riz');
  });
});

describe('Parcours récolte → stock', () => {
  it('campagne ouverte → récolte validée → entrée de paddy → stock et mouvement consultables', async () => {
    const idProduction = await creerProduction('1250.5');
    attendu(await appel('POST', `/productions/${idProduction}/validation`, jetonAdmin), 409, 'campagne_non_ouverte');
    assert.equal(await solde(ref.paddy), 0);

    attendu(await appel('POST', `/campagnes-agricoles/${ref.campagne}/ouverture`, jetonAdmin), 200);
    const validation = attendu(await appel('POST', `/productions/${idProduction}/validation`, jetonAdmin), 200);
    assert.equal(validation.corps.statut, 'validee');
    assert.equal(validation.corps.validated_by_id, idAdmin);
    assert.ok(validation.corps.validated_at);

    const stock = attendu(await appel('GET', `/stock?produit_id=${ref.paddy}`, jetonAgent), 200);
    assert.equal(stock.corps.items.length, 1);
    assert.equal(Number(stock.corps.items[0].quantite_disponible), 1250.5);
    assert.equal(stock.corps.items[0].unite_stock, 'kg');

    const mouvements = await mouvementsDe('production', idProduction, ref.paddy);
    assert.equal(mouvements.length, 1);
    assert.equal(mouvements[0].sens, 'entree');
    assert.equal(Number(mouvements[0].quantite), 1250.5);
    const fiche = attendu(await appel('GET', `/mouvements-stock/${mouvements[0]._id}`, jetonAgent), 200);
    assert.deepEqual(fiche.corps.origine, { type: 'production', id: idProduction });
    assert.equal(fiche.corps.contre_ecriture_id, null);

    // Une validation répétée renvoie le résultat existant sans nouveau mouvement.
    assert.equal(attendu(await appel('POST', `/productions/${idProduction}/validation`, jetonAdmin), 200).corps.statut, 'validee');
    assert.equal((await mouvementsDe('production', idProduction, ref.paddy)).length, 1);
    assert.equal(await solde(ref.paddy), 1250.5);
    ref.productionValidee = idProduction;
  });

  it('ne crée qu’un mouvement pour deux validations simultanées', async () => {
    const avant = await solde(ref.paddy);
    const idProduction = await creerProduction('100');
    const [premiere, seconde] = await Promise.all([
      appel('POST', `/productions/${idProduction}/validation`, jetonAdmin),
      appel('POST', `/productions/${idProduction}/validation`, jetonAdmin),
    ]);
    for (const reponse of [premiere, seconde]) {
      attendu(reponse, 200);
      assert.equal(reponse.corps.statut, 'validee');
    }
    assert.equal((await mouvementsDe('production', idProduction, ref.paddy)).length, 1);
    assert.equal(await solde(ref.paddy), avant + 100);
  });

  it('applique les règles de statut d’une récolte', async () => {
    attendu(await appel('PATCH', `/productions/${ref.productionValidee}`, jetonAdmin, { quantite: '1' }), 409, 'operation_non_modifiable');
    attendu(await appel('POST', `/productions/${ref.productionValidee}/annulation`, jetonAdmin, {}), 422, 'donnees_invalides');

    const brouillon = await creerProduction('5');
    assert.equal(attendu(await appel('PATCH', `/productions/${brouillon}`, jetonAdmin, { quantite: '6' }), 200).corps.quantite, '6');
    const annulation = attendu(await appel('POST', `/productions/${brouillon}/annulation`, jetonAdmin, { motif: 'Saisie en double' }), 200);
    assert.equal(annulation.corps.statut, 'annulee');
    assert.equal(annulation.corps.motif_annulation, 'Saisie en double');
    attendu(await appel('POST', `/productions/${brouillon}/validation`, jetonAdmin), 409, 'transition_invalide');
    assert.equal((await mouvementsDe('production', brouillon, ref.paddy)).length, 0);

    attendu(
      await appel('POST', '/productions', jetonAdmin, {
        campagne_id: ref.campagne,
        site_id: ref.siteA,
        produit_id: ref.paddy,
        date_recolte: '2026-10-20',
        superficie_recoltee_ha: '1',
        quantite: '0',
      }),
      422,
      'donnees_invalides',
    );
  });
});

describe('Unité de stock', () => {
  it('bloque le changement d’unité dès le premier mouvement, même si le solde revient à zéro', async () => {
    attendu(await appel('PATCH', `/produits/${ref.paddy}`, jetonAdmin, { unite_stock: 'tonne' }), 409, 'unite_stock_verrouillee');
    assert.equal(attendu(await appel('PATCH', `/produits/${ref.paddy}`, jetonAdmin, { nom: 'Paddy brut' }), 200).corps.nom, 'Paddy brut');

    const idProduction = await creerProduction('10', ref.son);
    attendu(await appel('POST', `/productions/${idProduction}/validation`, jetonAdmin), 200);
    const annulation = attendu(await appel('POST', `/productions/${idProduction}/annulation`, jetonAdmin, { motif: 'Erreur de produit' }), 200);
    assert.equal(annulation.corps.statut, 'annulee');
    assert.equal(await solde(ref.son), 0);
    const mouvements = await mouvementsDe('production', idProduction, ref.son);
    assert.equal(mouvements.length, 2);
    assert.ok(mouvements.some((m: { sens: string; annule_mouvement_id: string | null }) => m.sens === 'sortie' && m.annule_mouvement_id));
    attendu(await appel('PATCH', `/produits/${ref.son}`, jetonAdmin, { unite_stock: 'sac' }), 409, 'unite_stock_verrouillee');

    // Sans mouvement, l'unité reste modifiable.
    assert.equal(attendu(await appel('PATCH', `/produits/${ref.semence}`, jetonAdmin, { unite_stock: 'sac' }), 200).corps.unite_stock, 'sac');
  });
});

describe('Opérations agricoles et intrants', () => {
  it('prépare le stock d’intrants par une écriture manuelle des données de test', async () => {
    const mouvement = await stockService.enregistrerEcritureManuelle(authentificationService.contexteSysteme(), {
      produit_id: ref.engrais,
      sens: 'entree',
      quantite: '100',
      motif: 'Stock initial des données de test',
    });
    ref.mouvementManuel = mouvement._id;
    assert.equal(mouvement.origine_type, 'manuel');
    assert.equal(await solde(ref.engrais), 100);
  });

  it('sort les intrants du stock à la validation', async () => {
    const operation = await creerOperation([{ produit_id: ref.engrais, quantite: '30' }]);
    assert.equal(operation.corps.journees_travail, '2.5');
    assert.equal(operation.corps.cout_main_oeuvre, '15000');
    assert.equal(operation.corps.intrants.length, 1);
    const id = operation.corps._id;

    const validation = attendu(await appel('POST', `/operations-agricoles/${id}/validation`, jetonAdmin), 200);
    assert.equal(validation.corps.statut, 'validee');
    assert.equal(await solde(ref.engrais), 70);
    const mouvements = await mouvementsDe('operation_agricole', id, ref.engrais);
    assert.equal(mouvements.length, 1);
    assert.equal(mouvements[0].sens, 'sortie');
    assert.equal(mouvements[0].ligne_id, operation.corps.intrants[0].ligne_id);
    attendu(await appel('PATCH', `/operations-agricoles/${id}`, jetonAdmin, { journees_travail: '3' }), 409, 'operation_non_modifiable');
    ref.operationValidee = id;
  });

  it('refuse la validation si le stock est insuffisant et ne change rien', async () => {
    const operation = await creerOperation([
      { produit_id: ref.engrais, quantite: '10' },
      { produit_id: ref.engrais, quantite: '500' },
    ]);
    const refus = attendu(await appel('POST', `/operations-agricoles/${operation.corps._id}/validation`, jetonAdmin), 409, 'stock_insuffisant');
    assert.equal(refus.corps.erreur.details.produit_id, ref.engrais);
    assert.equal(attendu(await appel('GET', `/operations-agricoles/${operation.corps._id}`, jetonAdmin), 200).corps.statut, 'brouillon');
    assert.equal(await solde(ref.engrais), 70);
    assert.equal((await mouvementsDe('operation_agricole', operation.corps._id, ref.engrais)).length, 0);
  });

  it('contrepasse une opération validée annulée : les intrants reviennent en stock', async () => {
    const annulation = attendu(await appel('POST', `/operations-agricoles/${ref.operationValidee}/annulation`, jetonAdmin, { motif: 'Dose erronée' }), 200);
    assert.equal(annulation.corps.statut, 'annulee');
    assert.equal(await solde(ref.engrais), 100);
    const mouvements = await mouvementsDe('operation_agricole', ref.operationValidee, ref.engrais);
    assert.equal(mouvements.length, 2);
    const inverse = mouvements.find((m: { sens: string }) => m.sens === 'entree');
    assert.ok(inverse.annule_mouvement_id);
    assert.equal(inverse.motif, 'Dose erronée');
  });

  it('refuse d’annuler une récolte dont le produit a déjà été consommé', async () => {
    const idProduction = await creerProduction('10', ref.semence);
    attendu(await appel('POST', `/productions/${idProduction}/validation`, jetonAdmin), 200);
    const operation = await creerOperation([{ produit_id: ref.semence, quantite: '10' }]);
    attendu(await appel('POST', `/operations-agricoles/${operation.corps._id}/validation`, jetonAdmin), 200);

    attendu(await appel('POST', `/productions/${idProduction}/annulation`, jetonAdmin, { motif: 'Test' }), 409, 'stock_insuffisant');
    assert.equal(attendu(await appel('GET', `/productions/${idProduction}`, jetonAdmin), 200).corps.statut, 'validee');
  });
});

describe('Mouvements d’une opération (filtre origine_id)', () => {
  it('retrouve l’entrée et la contre-écriture d’une récolte parmi les mouvements du même produit', async () => {
    const annulee = await creerProduction('12');
    const autre = await creerProduction('8');
    attendu(await appel('POST', `/productions/${annulee}/validation`, jetonAdmin), 200);
    attendu(await appel('POST', `/productions/${autre}/validation`, jetonAdmin), 200);
    attendu(await appel('POST', `/productions/${annulee}/annulation`, jetonAdmin, { motif: 'Doublon' }), 200);

    const reponse = attendu(await appel('GET', `/mouvements-stock?origine_type=production&origine_id=${annulee}`, jetonAgent), 200);
    assert.equal(reponse.corps.total, 2);
    const entree = reponse.corps.items.find((m: { sens: string }) => m.sens === 'entree');
    const sortie = reponse.corps.items.find((m: { sens: string }) => m.sens === 'sortie');
    assert.equal(entree.quantite, '12');
    assert.equal(sortie.annule_mouvement_id, entree._id);
    assert.ok(reponse.corps.items.every((m: { origine_id: string }) => m.origine_id === annulee));

    const seule = attendu(await appel('GET', `/mouvements-stock?origine_type=production&origine_id=${autre}`, jetonAdmin), 200);
    assert.equal(seule.corps.total, 1);
    assert.equal(seule.corps.items[0].quantite, '8');
    attendu(await appel('GET', '/mouvements-stock?origine_id=invalide', jetonAdmin), 422, 'donnees_invalides');
  });
});

describe('Corrections de mouvements', () => {
  it('corrige une écriture manuelle par une contre-écriture unique et renvoie les écritures générées à leur origine', async () => {
    const generes = await mouvementsDe('production', ref.productionValidee, ref.paddy);
    attendu(await appel('POST', `/mouvements-stock/${generes[0]._id}/correction`, jetonAdmin, { motif: 'X' }), 409, 'correction_par_origine');
    attendu(await appel('POST', `/mouvements-stock/${ref.mouvementManuel}/correction`, jetonAgent, { motif: 'X' }), 403, 'acces_refuse');

    const correction = attendu(await appel('POST', `/mouvements-stock/${ref.mouvementManuel}/correction`, jetonAdmin, { motif: 'Stock initial erroné' }), 200);
    assert.equal(correction.corps.sens, 'sortie');
    assert.equal(correction.corps.origine_type, 'correction');
    assert.equal(correction.corps.annule_mouvement_id, ref.mouvementManuel);
    assert.equal(await solde(ref.engrais), 0);

    const repetition = attendu(await appel('POST', `/mouvements-stock/${ref.mouvementManuel}/correction`, jetonAdmin, { motif: 'Encore' }), 200);
    assert.equal(repetition.corps._id, correction.corps._id);
    assert.equal(await solde(ref.engrais), 0);
    assert.equal(attendu(await appel('GET', `/mouvements-stock/${ref.mouvementManuel}`, jetonAdmin), 200).corps.contre_ecriture_id, correction.corps._id);
    attendu(await appel('POST', `/mouvements-stock/${correction.corps._id}/correction`, jetonAdmin, { motif: 'X' }), 409, 'correction_par_origine');

    const filtres = attendu(await appel('GET', `/mouvements-stock?produit_id=${ref.engrais}&sens=sortie&date_debut=2026-01-01`, jetonAdmin), 200);
    assert.ok(filtres.corps.items.every((m: { sens: string }) => m.sens === 'sortie'));
  });
});

describe('Périmètre et clôture', () => {
  it('limite un utilisateur à ses sites', async () => {
    const productionB = await creerProduction('7', ref.paddy, ref.siteB);
    attendu(await appel('GET', `/productions/${productionB}`, jetonSiteA), 404, 'ressource_introuvable');
    attendu(await appel('GET', `/productions?site_id=${ref.siteB}`, jetonSiteA), 403, 'acces_refuse');
    const liste = attendu(await appel('GET', `/productions?campagne_id=${ref.campagne}&taille_page=100`, jetonSiteA), 200);
    assert.ok(liste.corps.items.length > 0);
    assert.ok(liste.corps.items.every((p: { site_id: string }) => p.site_id === ref.siteA));
    attendu(
      await appel('POST', '/productions', jetonSiteA, {
        campagne_id: ref.campagne,
        site_id: ref.siteB,
        produit_id: ref.paddy,
        date_recolte: '2026-10-21',
        superficie_recoltee_ha: '1',
        quantite: '3',
      }),
      403,
      'acces_refuse',
    );
    attendu(await appel('POST', `/productions/${productionB}/validation`, jetonSiteA), 404, 'ressource_introuvable');
    attendu(await appel('POST', `/mouvements-stock/${ref.mouvementManuel}/correction`, jetonSiteA, { motif: 'X' }), 403, 'acces_refuse');
  });

  it('conserve la consultation après clôture et refuse les écritures', async () => {
    attendu(await appel('POST', `/campagnes-agricoles/${ref.campagne}/cloture`, jetonAdmin), 200);
    assert.equal(attendu(await appel('GET', `/productions/${ref.productionValidee}`, jetonAdmin), 200).corps.statut, 'validee');
    assert.ok(attendu(await appel('GET', `/operations-agricoles?campagne_id=${ref.campagne}`, jetonAdmin), 200).corps.total > 0);
    assert.equal(attendu(await appel('GET', `/cultures/${ref.culture}`, jetonAdmin), 200).corps.culture, 'Riz');

    attendu(await appel('POST', `/productions/${ref.productionValidee}/annulation`, jetonAdmin, { motif: 'Trop tard' }), 409, 'campagne_cloturee');
    attendu(await appel('PATCH', `/cultures/${ref.culture}`, jetonAdmin, { superficie_ha: '10' }), 409, 'campagne_cloturee');
    attendu(
      await appel('POST', '/productions', jetonAdmin, {
        campagne_id: ref.campagne,
        site_id: ref.siteA,
        produit_id: ref.paddy,
        date_recolte: '2026-12-01',
        superficie_recoltee_ha: '1',
        quantite: '3',
      }),
      409,
      'campagne_cloturee',
    );
  });
});
