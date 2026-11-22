/**
 * Tests d'intégration sur la base Atlas de tests : justificatifs de dépenses par l'API (octets bruts),
 * journal des opérations, paramètres de l'entreprise et tableaux de bord sur un scénario chiffré connu.
 * Les données créées portent le préfixe « TST-<suffixe> » et sont supprimées à la fin.
 * Utilisation : npm run test:consultations
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
import { mediaService } from '../src/modules/media/services/mediaService.js';

interface Reponse {
  statut: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  corps: any;
}

const suffixe = Date.now().toString(36).toUpperCase();
const prefixe = `TST-${suffixe}`;
const MOT_DE_PASSE = 'Consultations-2026!';
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const PDF_MINIMAL = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

let serveur: Server;
let urlApi: string;
let jetonAdmin: string;
let idAdmin: string;
let jetonAgent: string;
let jetonSiteA: string;
let jetonTransfo: string;
let jetonJournal: string;
const ref: Record<string, string> = {};
const mediasCrees: { public_id: string; type_ressource: 'image' | 'raw' }[] = [];

async function appel(methode: string, chemin: string, jeton?: string, corps?: unknown): Promise<Reponse> {
  const entetes: Record<string, string> = {};
  if (jeton) entetes.Authorization = `Bearer ${jeton}`;
  if (corps !== undefined) entetes['Content-Type'] = 'application/json';
  const reponse = await fetch(urlApi + chemin, { method: methode, headers: entetes, body: corps === undefined ? undefined : JSON.stringify(corps) });
  const texte = await reponse.text();
  return { statut: reponse.status, corps: texte ? JSON.parse(texte) : undefined };
}

/** PUT du justificatif : octets bruts et type déclaré dans Content-Type. */
async function envoyerFichier(depenseId: string, contenu: Buffer, type: string, jeton = jetonSiteA, nom?: string): Promise<Reponse> {
  const entetes: Record<string, string> = { Authorization: `Bearer ${jeton}`, 'Content-Type': type };
  if (nom) entetes['X-Nom-Fichier'] = encodeURIComponent(nom);
  const reponse = await fetch(`${urlApi}/depenses/${depenseId}/justificatif`, { method: 'PUT', headers: entetes, body: contenu });
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

const creer = async (chemin: string, corps: unknown, jeton = jetonAdmin) => attendu(await appel('POST', chemin, jeton, corps), 201).corps._id as string;
const valider = async (chemin: string, jeton = jetonAdmin) => attendu(await appel('POST', `${chemin}/validation`, jeton), 200);
const annuler = async (chemin: string, motif = 'Test') => attendu(await appel('POST', `${chemin}/annulation`, jetonAdmin, { motif }), 200);

before(async () => {
  await connecterMongo(configuration.mongodbBaseTests);
  const { administrateur, limite } = await initialiserComptesTests();
  serveur = creerApplication().listen(0);
  urlApi = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}/api/v1`;
  ({ jeton: jetonAdmin, id: idAdmin } = await connecter(administrateur.email, administrateur.mot_de_passe));
  ({ jeton: jetonAgent } = await connecter(limite.email, limite.mot_de_passe));

  ref.categorie = await creer('/categories-produits', { code: `${prefixe}-CAT`, nom: 'Riz' });
  const produit = (code: string, activites: string[], extra: object = {}) =>
    creer('/produits', { code: `${prefixe}-${code}`, nom: code, categorie_id: ref.categorie, unite_stock: 'kg', activites, ...extra });
  ref.paddy = await produit('PADDY', ['production', 'transformation']);
  ref.riz = await produit('RIZ', ['transformation', 'commercialisation'], { prix_vente: '450' });
  ref.son = await produit('SON', ['transformation', 'commercialisation']);
  ref.siteA = await creer('/sites-production', { code: `${prefixe}-A`, nom: 'Site A' });
  ref.siteB = await creer('/sites-production', { code: `${prefixe}-B`, nom: 'Site B' });
  ref.campagne = await creer('/campagnes-agricoles', {
    code: `${prefixe}-HIV`, nom: 'Hivernage', date_debut: '2026-06-01', date_fin: '2026-12-31', site_ids: [ref.siteA, ref.siteB],
  });
  attendu(await appel('POST', `/campagnes-agricoles/${ref.campagne}/ouverture`, jetonAdmin), 200);
  ref.typeOperation = await creer('/types-operations-agricoles', { code: `${prefixe}-LAB`, nom: 'Labour' });
  ref.typeDepense = await creer('/types-depenses', { code: `${prefixe}-MO`, nom: 'Main-d’œuvre' });
  ref.unite = await creer('/unites-transformation', { code: `${prefixe}-UT`, nom: 'Rizerie' });
  ref.client = await creer('/clients', { nom: `${prefixe} Client tableau de bord` });

  const role = (code: string, permissions: { module: string; action: string }[]) =>
    creer('/roles', { code: `test_${suffixe.toLowerCase()}_${code}`, nom: code, permissions });
  const actions = (modules: string[], liste = ['consultation', 'saisie', 'validation']) =>
    modules.flatMap((module) => liste.map((action) => ({ module, action })));
  const roleTerrain = await role('terrain', [...actions(['depenses']), ...actions(['tableau_de_bord_production', 'tableau_de_bord_transformation'], ['consultation'])]);
  const roleJournal = await role('journal', actions(['journal_operations', 'depenses'], ['consultation']));
  const compte = async (nom: string, roleId: string, activites: string[], site_ids: string[] = []) => {
    const email = `test.${nom}.${suffixe.toLowerCase()}@riz-de-niono.test`;
    await creer('/utilisateurs', { nom: `Test ${nom}`, email, mot_de_passe: MOT_DE_PASSE, role_id: roleId, activites, site_ids });
    return (await connecter(email, MOT_DE_PASSE)).jeton;
  };
  jetonSiteA = await compte('tdb-site-a', roleTerrain, ['production'], [ref.siteA]);
  jetonTransfo = await compte('tdb-transfo', roleTerrain, ['transformation']);
  jetonJournal = await compte('lecteur-journal', roleJournal, ['production']);
});

after(async () => {
  serveur?.close();
  for (const media of mediasCrees) await mediaService.supprimer(media.public_id, media.type_ressource).catch(() => false);
  const base = mongoose.connection.db;
  if (!base) return;
  const motif = { $regex: `^${prefixe}` };
  const idsDe = async (collection: string, filtre: object) =>
    (await base.collection(collection).find(filtre, { projection: { _id: 1 } }).toArray()).map((d) => d._id);
  const supprimer = async (collection: string, filtre: object) => {
    const ids = await idsDe(collection, filtre);
    await base.collection(collection).deleteMany({ _id: { $in: ids } });
    return ids;
  };

  const clients = await idsDe('clients', { nom: motif });
  const ventes = await idsDe('ventes', { client_id: { $in: clients } });
  const campagnes = await idsDe('campagnes_agricoles', { code: motif });
  const unites = await idsDe('unites_transformation', { code: motif });
  const produits = await idsDe('produits', { code: motif });
  const documents = [
    ...(await supprimer('encaissements', { vente_id: { $in: ventes } })),
    ...(await supprimer('retours_clients', { vente_id: { $in: ventes } })),
    ...(await supprimer('ventes', { _id: { $in: ventes } })),
    ...(await supprimer('commandes_clients', { client_id: { $in: clients } })),
    ...(await supprimer('clients', { _id: { $in: clients } })),
    ...(await supprimer('operations_transformation', { unite_transformation_id: { $in: unites } })),
    ...(await supprimer('cultures', { campagne_id: { $in: campagnes } })),
    ...(await supprimer('productions', { campagne_id: { $in: campagnes } })),
    ...(await supprimer('operations_agricoles', { campagne_id: { $in: campagnes } })),
    ...(await supprimer('depenses', { libelle: motif })),
    ...(await supprimer('inventaires', { 'lignes.produit_id': { $in: produits } })),
    ...(await supprimer('mouvements_stock', { produit_id: { $in: produits } })),
  ];
  await base.collection('stocks').deleteMany({ produit_id: { $in: produits } });
  for (const collection of ['categories_produits', 'produits', 'sites_production', 'campagnes_agricoles', 'types_operations_agricoles', 'types_depenses', 'unites_transformation']) {
    documents.push(...(await supprimer(collection, { code: motif })));
  }
  const utilisateurs = await idsDe('utilisateurs', { email: { $regex: '^test\\.' } });
  const roles = await idsDe('roles', { code: { $regex: '^test_' } });
  await base.collection('sessions').deleteMany({ utilisateur_id: { $in: utilisateurs } });
  await base.collection('journal_operations').deleteMany({ document_id: { $in: [...documents, ...utilisateurs, ...roles] } });
  await base.collection('utilisateurs').deleteMany({ _id: { $in: utilisateurs } });
  await base.collection('roles').deleteMany({ _id: { $in: roles } });
  await deconnecterMongo();
});

const depense = (corps: Record<string, unknown>) => ({
  activite: 'production', type_depense_id: ref.typeDepense, date_depense: '2026-07-15', campagne_id: ref.campagne, ...corps,
});

describe('Justificatifs de dépenses par l’API', () => {
  it('ajoute, remplace et retire un justificatif', async () => {
    ref.depenseJustifiee = await creer('/depenses', depense({ site_id: ref.siteA, montant: '12000', libelle: `${prefixe} Repas équipe` }), jetonSiteA);

    const ajout = attendu(await envoyerFichier(ref.depenseJustifiee, PNG_1X1, 'image/png', jetonSiteA, 'reçu repas.png'), 200);
    assert.equal(ajout.corps._id, ref.depenseJustifiee);
    assert.equal(ajout.corps.justificatif.type_ressource, 'image');
    assert.equal(ajout.corps.justificatif.nom_fichier, 'reçu repas.png');
    assert.equal((await fetch(ajout.corps.justificatif.url_securisee)).status, 200);
    const premier = (await mongoose.connection.db!.collection('depenses').findOne({ _id: new mongoose.Types.ObjectId(ref.depenseJustifiee) }))!.justificatif;
    mediasCrees.push(premier);

    const remplacement = attendu(await envoyerFichier(ref.depenseJustifiee, PDF_MINIMAL, 'application/pdf'), 200);
    assert.equal(remplacement.corps.justificatif.type_ressource, 'raw');
    const second = (await mongoose.connection.db!.collection('depenses').findOne({ _id: new mongoose.Types.ObjectId(ref.depenseJustifiee) }))!.justificatif;
    mediasCrees.push(second);
    assert.equal(await mediaService.supprimer(premier.public_id, premier.type_ressource), false, 'l’ancien fichier est supprimé');

    const retrait = attendu(await appel('DELETE', `/depenses/${ref.depenseJustifiee}/justificatif`, jetonSiteA), 200);
    assert.equal(retrait.corps.justificatif, null);
    assert.equal(await mediaService.supprimer(second.public_id, second.type_ressource), false, 'le fichier retiré est supprimé');
  });

  it('refuse un fichier invalide ou trop volumineux et les accès hors périmètre', async () => {
    attendu(await envoyerFichier(ref.depenseJustifiee, Buffer.from('ceci n’est pas une image'), 'image/png'), 422, 'contenu_fichier_invalide');
    attendu(await envoyerFichier(ref.depenseJustifiee, PDF_MINIMAL, 'image/jpeg'), 422, 'contenu_fichier_invalide');
    attendu(await envoyerFichier(ref.depenseJustifiee, Buffer.from('texte'), 'text/plain'), 422, 'type_fichier_refuse');
    attendu(await envoyerFichier(ref.depenseJustifiee, Buffer.alloc(0), 'image/png'), 422, 'taille_fichier_refusee');
    const tropGros = Buffer.alloc(10 * 1024 * 1024 + 1);
    PNG_1X1.copy(tropGros);
    attendu(await envoyerFichier(ref.depenseJustifiee, tropGros, 'image/png'), 422, 'taille_fichier_refusee');

    const depenseB = await creer('/depenses', depense({ site_id: ref.siteB, montant: '5000', libelle: `${prefixe} Dépense site B` }));
    attendu(await envoyerFichier(depenseB, PNG_1X1, 'image/png', jetonSiteA), 404, 'ressource_introuvable');
    attendu(await appel('DELETE', `/depenses/${depenseB}/justificatif`, jetonSiteA), 404, 'ressource_introuvable');
    attendu(await envoyerFichier(ref.depenseJustifiee, PNG_1X1, 'image/png', jetonTransfo), 404, 'ressource_introuvable');
    attendu(await envoyerFichier(ref.depenseJustifiee, PNG_1X1, 'image/png', jetonAgent), 403, 'acces_refuse');
    attendu(await envoyerFichier(ref.depenseJustifiee, PNG_1X1, 'image/png', jetonJournal), 403, 'acces_refuse');
    attendu(await envoyerFichier(ref.depenseJustifiee, PNG_1X1, 'image/png', 'jeton-invalide'), 401, 'session_invalide');

    await annuler(`/depenses/${depenseB}`, 'Doublon');
    attendu(await envoyerFichier(depenseB, PNG_1X1, 'image/png', jetonAdmin), 409, 'depense_annulee');
  });
});

describe('Journal des opérations', () => {
  it('liste et détaille les événements avec leurs filtres', async () => {
    const liste = attendu(await appel('GET', `/journal-operations?utilisateur_id=${idAdmin}&action=annulation&taille_page=100`, jetonAdmin), 200);
    assert.ok(liste.corps.items.length > 0);
    assert.ok(liste.corps.items.every((e: { action: string; utilisateur_id: string }) => e.action === 'annulation' && e.utilisateur_id === idAdmin));
    const evenement = liste.corps.items[0];
    assert.equal(evenement.auteur_nom, 'Administrateur des tests');
    const fiche = attendu(await appel('GET', `/journal-operations/${evenement._id}`, jetonAdmin), 200);
    assert.deepEqual(fiche.corps.origine, { collection: evenement.collection, document_id: evenement.document_id, module: evenement.collection });
    const periode = attendu(await appel('GET', '/journal-operations?date_debut=2000-01-01&date_fin=2000-12-31', jetonAdmin), 200);
    assert.equal(periode.corps.total, 0);
    attendu(await appel('GET', '/journal-operations?action=inconnue', jetonAdmin), 422, 'donnees_invalides');
  });

  it('limite les événements aux modules que l’utilisateur peut consulter', async () => {
    const liste = attendu(await appel('GET', '/journal-operations?taille_page=100', jetonJournal), 200);
    assert.ok(liste.corps.items.length > 0);
    assert.ok(liste.corps.items.every((e: { collection: string }) => e.collection === 'depenses'));
    const evenementRole = attendu(await appel('GET', '/journal-operations?taille_page=1&action=creation', jetonAdmin), 200);
    const roles = attendu(await appel('GET', `/journal-operations?utilisateur_id=${idAdmin}&taille_page=100`, jetonAdmin), 200).corps.items
      .find((e: { collection: string }) => e.collection === 'roles');
    assert.ok(evenementRole.corps.total > 0 && roles);
    attendu(await appel('GET', `/journal-operations/${roles._id}`, jetonJournal), 404, 'ressource_introuvable');
    attendu(await appel('GET', '/journal-operations', jetonSiteA), 403, 'acces_refuse');
  });
});

describe('Paramètres de l’entreprise', () => {
  it('consulte et modifie les paramètres avec la permission d’administration', async () => {
    const avant = attendu(await appel('GET', '/parametres-entreprise', jetonAdmin), 200).corps;
    assert.ok(avant.nom);
    assert.match(avant.devise, /^[A-Z]{3}$/);
    try {
      attendu(await appel('PATCH', '/parametres-entreprise', jetonAdmin, { coordonnees: { email: 'pas-un-email' } }), 422, 'donnees_invalides');
      attendu(await appel('PATCH', '/parametres-entreprise', jetonAdmin, { devise: 'EURO' }), 422, 'donnees_invalides');
      const modification = attendu(
        await appel('PATCH', '/parametres-entreprise', jetonAdmin, { nom: `${prefixe} Riz de Niono SA`, devise: 'xof', coordonnees: { telephone: '+223 21 00 00 00' } }),
        200,
      );
      assert.equal(modification.corps.nom, `${prefixe} Riz de Niono SA`);
      assert.equal(modification.corps.devise, 'XOF');
      assert.equal(modification.corps.coordonnees.telephone, '+223 21 00 00 00');
      assert.equal(modification.corps.coordonnees.adresse, avant.coordonnees.adresse);
      attendu(await appel('PATCH', '/parametres-entreprise', jetonSiteA, { nom: 'X' }), 403, 'acces_refuse');
      attendu(await appel('GET', '/parametres-entreprise', jetonSiteA), 403, 'acces_refuse');
    } finally {
      attendu(await appel('PATCH', '/parametres-entreprise', jetonAdmin, { nom: avant.nom, devise: avant.devise, coordonnees: avant.coordonnees }), 200);
    }
  });
});

describe('Tableau de bord de production', () => {
  const chemin = () => `/tableaux-de-bord/production?campagne_id=${ref.campagne}`;

  it('prépare un scénario chiffré', async () => {
    await creer('/cultures', { campagne_id: ref.campagne, site_id: ref.siteA, culture: 'Riz', superficie_ha: '10' });
    await creer('/cultures', { campagne_id: ref.campagne, site_id: ref.siteB, culture: 'Riz', superficie_ha: '5' });
    const recolte = (site: string, quantite: string, superficie: string) =>
      creer('/productions', { campagne_id: ref.campagne, site_id: site, produit_id: ref.paddy, date_recolte: '2026-10-20', superficie_recoltee_ha: superficie, quantite });
    await valider(`/productions/${await recolte(ref.siteA, '30000', '8')}`);
    await valider(`/productions/${await recolte(ref.siteB, '12000', '4')}`);
    await recolte(ref.siteA, '999', '1'); // brouillon : exclu
    const travail = (site: string) =>
      creer('/operations-agricoles', { campagne_id: ref.campagne, site_id: site, type_operation_id: ref.typeOperation, date_operation: '2026-07-01' });
    await valider(`/operations-agricoles/${await travail(ref.siteA)}`);
    await valider(`/operations-agricoles/${await travail(ref.siteA)}`);
    await valider(`/operations-agricoles/${await travail(ref.siteB)}`);
    await travail(ref.siteA); // planifié
    await valider(`/depenses/${await creer('/depenses', depense({ site_id: ref.siteA, montant: '100000', libelle: `${prefixe} Engrais A` }))}`);
    await valider(`/depenses/${await creer('/depenses', depense({ site_id: ref.siteB, montant: '50000', libelle: `${prefixe} Engrais B` }))}`);
    ref.depenseAnnulee = await creer('/depenses', depense({ site_id: ref.siteA, montant: '70000', libelle: `${prefixe} À annuler` }));
    await valider(`/depenses/${ref.depenseAnnulee}`);
    await creer('/depenses', depense({ site_id: ref.siteA, montant: '20000', libelle: `${prefixe} Brouillon` })); // brouillon : exclu
  });

  it('calcule superficies, récoltes, rendements, travaux et dépenses ; une dépense annulée sort des totaux', async () => {
    assert.equal(attendu(await appel('GET', chemin(), jetonAdmin), 200).corps.depenses_enregistrees, '220000');
    await annuler(`/depenses/${ref.depenseAnnulee}`, 'Facture refusée');

    const tableau = attendu(await appel('GET', chemin(), jetonAdmin), 200).corps;
    assert.equal(tableau.superficie_cultivee_ha, '15');
    assert.equal(tableau.superficie_recoltee_ha, '12');
    assert.deepEqual(tableau.recoltes, [
      { produit_id: ref.paddy, unite_stock: 'kg', quantite: '42000', superficie_recoltee_ha: '12', rendement_kg_ha: '3500' },
    ]);
    assert.deepEqual(tableau.travaux, { realises: 3, planifies: 1 });
    assert.equal(tableau.depenses_enregistrees, '150000');
    const siteA = tableau.par_site.find((s: { site_id: string }) => s.site_id === ref.siteA);
    const siteB = tableau.par_site.find((s: { site_id: string }) => s.site_id === ref.siteB);
    assert.equal(siteA.superficie_cultivee_ha, '10');
    assert.equal(siteA.recoltes[0].rendement_kg_ha, '3750');
    assert.deepEqual(siteA.travaux, { realises: 2, planifies: 1 });
    assert.equal(siteA.depenses_enregistrees, '100000');
    assert.equal(siteB.recoltes[0].quantite, '12000');
    assert.equal(siteB.recoltes[0].rendement_kg_ha, '3000');
    assert.equal(siteB.depenses_enregistrees, '50000');
  });

  it('ne montre à un utilisateur limité à un site que les chiffres de ce site', async () => {
    const tableau = attendu(await appel('GET', chemin(), jetonSiteA), 200).corps;
    assert.equal(tableau.superficie_cultivee_ha, '10');
    assert.equal(tableau.recoltes[0].quantite, '30000');
    assert.equal(tableau.depenses_enregistrees, '100000');
    assert.deepEqual(tableau.par_site.map((s: { site_id: string }) => s.site_id), [ref.siteA]);
    attendu(await appel('GET', `${chemin()}&site_id=${ref.siteB}`, jetonSiteA), 403, 'acces_refuse');
    assert.equal(attendu(await appel('GET', `${chemin()}&site_id=${ref.siteB}`, jetonAdmin), 200).corps.depenses_enregistrees, '50000');
    attendu(await appel('GET', chemin(), jetonTransfo), 403, 'acces_refuse');
    attendu(await appel('GET', chemin(), jetonJournal), 403, 'acces_refuse');
  });
});

describe('Tableau de bord de transformation', () => {
  it('calcule paddy consommé, produits obtenus, rendements et dépenses directes par période', async () => {
    const inventaire = await creer('/inventaires', { date_inventaire: '2026-11-01', lignes: [{ produit_id: ref.paddy, quantite_comptee: '2000', motif_ecart: 'Stock initial' }] });
    await valider(`/inventaires/${inventaire}`);
    const transformation = (date: string, paddy: string, resultats: { produit_id: string; quantite: string }[]) =>
      creer('/operations-transformation', { unite_transformation_id: ref.unite, date_operation: date, paddy_produit_id: ref.paddy, quantite_paddy: paddy, resultats });
    await valider(`/operations-transformation/${await transformation('2026-11-05', '1000', [{ produit_id: ref.riz, quantite: '650' }, { produit_id: ref.son, quantite: '150' }])}`);
    await valider(`/operations-transformation/${await transformation('2026-11-06', '500', [{ produit_id: ref.riz, quantite: '320' }])}`);
    await valider(`/operations-transformation/${await transformation('2026-12-10', '200', [{ produit_id: ref.riz, quantite: '130' }])}`);
    await transformation('2026-11-07', '100', [{ produit_id: ref.riz, quantite: '60' }]); // brouillon : exclu
    const depenseTransfo = (date: string, montant: string, libelle: string) =>
      creer('/depenses', { activite: 'transformation', type_depense_id: ref.typeDepense, date_depense: date, montant, libelle: `${prefixe} ${libelle}`, unite_transformation_id: ref.unite });
    await valider(`/depenses/${await depenseTransfo('2026-11-05', '40000', 'Électricité')}`);
    await valider(`/depenses/${await depenseTransfo('2026-12-10', '9000', 'Électricité décembre')}`);
    const annulee = await depenseTransfo('2026-11-08', '15000', 'Annulée');
    await valider(`/depenses/${annulee}`);
    await annuler(`/depenses/${annulee}`);

    const novembre = attendu(
      await appel('GET', `/tableaux-de-bord/transformation?unite_transformation_id=${ref.unite}&date_debut=2026-11-01&date_fin=2026-11-30`, jetonTransfo),
      200,
    ).corps;
    assert.equal(novembre.operations_validees, 2);
    assert.deepEqual(novembre.paddy_consomme, [{ produit_id: ref.paddy, unite_stock: 'kg', quantite: '1500' }]);
    const parProduit = (tableau: { produits_obtenus: { produit_id: string; quantite: string }[] }, id: string) =>
      tableau.produits_obtenus.find((p) => p.produit_id === id);
    assert.deepEqual(parProduit(novembre, ref.riz), { produit_id: ref.riz, unite_stock: 'kg', quantite: '970', rendement_pct: '64.67' });
    assert.deepEqual(parProduit(novembre, ref.son), { produit_id: ref.son, unite_stock: 'kg', quantite: '150', rendement_pct: '10' });
    assert.equal(novembre.depenses_directes, '40000');

    const total = attendu(await appel('GET', `/tableaux-de-bord/transformation?unite_transformation_id=${ref.unite}`, jetonTransfo), 200).corps;
    assert.equal(total.operations_validees, 3);
    assert.equal(total.paddy_consomme[0].quantite, '1700');
    assert.equal(parProduit(total, ref.riz)?.quantite, '1100');
    assert.equal(total.depenses_directes, '49000');
    attendu(await appel('GET', '/tableaux-de-bord/transformation', jetonSiteA), 403, 'acces_refuse');
  });
});

describe('Tableau de bord commercial', () => {
  it('calcule ventes, quantités, livraisons, encaissements et soldes pour un client', async () => {
    const commande = await creer('/commandes-clients', { client_id: ref.client, date_commande: '2026-11-12', lignes: [{ produit_id: ref.riz, quantite: '100' }] });
    const livraison = attendu(await appel('POST', `/commandes-clients/${commande}/livraison`, jetonAdmin), 200).corps.vente;
    await creer('/commandes-clients', { client_id: ref.client, date_commande: '2026-11-12', lignes: [{ produit_id: ref.riz, quantite: '50' }] }); // non livrée
    const directe = await creer('/ventes', {
      client_id: ref.client, activite: 'commercialisation', date_vente: '2026-11-10', lignes: [{ produit_id: ref.riz, quantite: '20', prix_unitaire: '500' }],
    });
    await valider(`/ventes/${directe}`);
    const paiement = (montant: string) => creer('/encaissements', { vente_id: livraison._id, date_paiement: '2026-11-13', montant, mode: 'especes' });
    await valider(`/encaissements/${await paiement('30000')}`);
    const annule = await paiement('5000');
    await valider(`/encaissements/${annule}`);
    await annuler(`/encaissements/${annule}`);
    const retour = await creer('/retours-clients', {
      vente_id: livraison._id, date_retour: '2026-11-14', lignes: [{ ligne_vente_id: livraison.lignes[0].ligne_id, quantite: '10', quantite_revendable: '10', motif: 'Sacs abîmés' }],
    });
    await valider(`/retours-clients/${retour}`);

    const tableau = attendu(await appel('GET', `/tableaux-de-bord/commercialisation?client_id=${ref.client}`, jetonAdmin), 200).corps;
    assert.deepEqual(tableau.ventes_validees, { nombre: 2, montant_total: '55000' });
    assert.deepEqual(tableau.quantites_vendues, [
      { produit_id: ref.riz, unite_stock: 'kg', quantite: '120', quantite_retournee: '10', montant: '55000' },
    ]);
    assert.deepEqual(tableau.commandes_livrees, { nombre: 1, montant_total: '45000' });
    assert.equal(tableau.encaissements, '30000');
    assert.deepEqual(tableau.soldes, { montant_total: '55000', montant_encaisse: '30000', montant_retours: '4500', solde: '20500', trop_percu: '0' });

    const autreProduit = attendu(await appel('GET', `/tableaux-de-bord/commercialisation?client_id=${ref.client}&produit_id=${ref.son}`, jetonAdmin), 200).corps;
    assert.deepEqual(autreProduit.quantites_vendues, []);
    const ancienne = attendu(await appel('GET', `/tableaux-de-bord/commercialisation?client_id=${ref.client}&date_debut=2020-01-01&date_fin=2020-12-31`, jetonAdmin), 200).corps;
    assert.deepEqual(ancienne.ventes_validees, { nombre: 0, montant_total: '0' });
    assert.equal(ancienne.encaissements, '0');
    attendu(await appel('GET', '/tableaux-de-bord/commercialisation', jetonSiteA), 403, 'acces_refuse');
  });
});
