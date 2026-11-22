/**
 * Tests d'intégration des modules Fournisseurs, Achats et Règlements fournisseurs sur la base Atlas
 * de tests : parcours fournisseur → achat d'intrants → réception → stock → règlement partiel →
 * consommation dans une opération agricole, réception simultanée, achat de service, périmètre et annulations.
 * Les données créées portent le préfixe « TST-<suffixe> » et sont supprimées à la fin.
 * Utilisation : npm run test:achats
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
const MOT_DE_PASSE = 'Achats-Tests-2026!';

let serveur: Server;
let urlApi: string;
let jetonAdmin: string;
let jetonAgent: string;
let jetonSiteA: string;
let jetonTransformation: string;
const ref: Record<string, string> = {};

async function appel(methode: string, chemin: string, jeton?: string, corps?: unknown): Promise<Reponse> {
  const entetes: Record<string, string> = {};
  if (jeton) entetes.Authorization = `Bearer ${jeton}`;
  if (corps !== undefined) entetes['Content-Type'] = 'application/json';
  const reponse = await fetch(urlApi + chemin, { method: methode, headers: entetes, body: corps === undefined ? undefined : JSON.stringify(corps) });
  const texte = await reponse.text();
  return { statut: reponse.status, corps: texte ? JSON.parse(texte) : undefined };
}

function attendu(reponse: Reponse, statut: number, code?: string): Reponse {
  assert.equal(reponse.statut, statut, JSON.stringify(reponse.corps));
  if (code) assert.equal(reponse.corps?.erreur?.code, code);
  return reponse;
}

async function connecter(email: string, motDePasse: string): Promise<string> {
  return attendu(await appel('POST', '/auth/connexion', undefined, { email, mot_de_passe: motDePasse }), 200).corps.jeton;
}

async function solde(produitId: string): Promise<number> {
  const reponse = attendu(await appel('GET', `/stock?produit_id=${produitId}`, jetonAdmin), 200);
  return reponse.corps.items.length === 0 ? 0 : Number(reponse.corps.items[0].quantite_disponible);
}

async function mouvementsAchat(achatId: string, produitId: string) {
  const reponse = attendu(await appel('GET', `/mouvements-stock?produit_id=${produitId}&origine_type=achat&taille_page=100`, jetonAdmin), 200);
  return reponse.corps.items.filter((m: { origine_id: string }) => m.origine_id === achatId);
}

const ligneEngrais = (quantite: string, prix = '12500') => ({ libelle: 'Engrais NPK', produit_id: ref.engrais, quantite, prix_unitaire: prix });
const ligneTransport = { libelle: 'Transport', quantite: '1', prix_unitaire: '20000' };

async function creerAchat(corps: Record<string, unknown>, jeton = jetonAdmin): Promise<Reponse> {
  return appel('POST', '/achats', jeton, { activite: 'production', fournisseur_id: ref.fournisseur, date_achat: '2026-06-10', ...corps });
}

/** Achat de production validé (et reçu si demandé), créé par l'administrateur. */
async function achatValide(lignes: unknown[], { recu = false, site = ref.siteA } = {}): Promise<string> {
  const id = attendu(await creerAchat({ lignes, site_id: site, campagne_id: ref.campagne }), 201).corps._id;
  attendu(await appel('POST', `/achats/${id}/validation`, jetonAdmin), 200);
  if (recu) attendu(await appel('POST', `/achats/${id}/reception`, jetonAdmin), 200);
  return id;
}

async function reglementValide(achatId: string, montant: string): Promise<string> {
  const id = attendu(
    await appel('POST', '/reglements-fournisseurs', jetonAdmin, { achat_id: achatId, date_paiement: '2026-06-20', montant, mode: 'virement' }),
    201,
  ).corps._id;
  attendu(await appel('POST', `/reglements-fournisseurs/${id}/validation`, jetonAdmin), 200);
  return id;
}

before(async () => {
  await connecterMongo(configuration.mongodbBaseTests);
  const { administrateur, limite } = await initialiserComptesTests();
  serveur = creerApplication().listen(0);
  urlApi = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}/api/v1`;
  jetonAdmin = await connecter(administrateur.email, administrateur.mot_de_passe);
  jetonAgent = await connecter(limite.email, limite.mot_de_passe);

  const creer = async (chemin: string, corps: unknown) => attendu(await appel('POST', chemin, jetonAdmin, corps), 201).corps._id as string;
  ref.categorie = await creer('/categories-produits', { code: `${prefixe}-CAT`, nom: 'Intrants' });
  const produit = (code: string, activites: string[], extra: object = {}) =>
    creer('/produits', { code: `${prefixe}-${code}`, nom: code, categorie_id: ref.categorie, unite_stock: 'sac', activites, ...extra });
  ref.engrais = await produit('NPK', ['production']);
  ref.uree = await produit('UREE', ['production']);
  ref.riz = await produit('RIZ', ['commercialisation']);
  ref.sacsVides = await produit('SACS', ['production'], { stockable: false });
  ref.siteA = await creer('/sites-production', { code: `${prefixe}-A`, nom: 'Site A' });
  ref.siteB = await creer('/sites-production', { code: `${prefixe}-B`, nom: 'Site B' });
  ref.siteHors = await creer('/sites-production', { code: `${prefixe}-H`, nom: 'Site hors campagne' });
  ref.campagne = await creer('/campagnes-agricoles', {
    code: `${prefixe}-HIV`, nom: 'Hivernage', date_debut: '2026-06-01', date_fin: '2026-12-31', site_ids: [ref.siteA, ref.siteB],
  });
  attendu(await appel('POST', `/campagnes-agricoles/${ref.campagne}/ouverture`, jetonAdmin), 200);
  ref.typeOperation = await creer('/types-operations-agricoles', { code: `${prefixe}-FERT`, nom: 'Fertilisation' });

  const permissions = [
    ...['fournisseurs', 'achats', 'reglements_fournisseurs', 'operations_agricoles'].flatMap((module) =>
      ['consultation', 'saisie', 'validation'].map((action) => ({ module, action })),
    ),
    { module: 'stock', action: 'consultation' },
  ];
  const role = await creer('/roles', { code: `test_${suffixe.toLowerCase()}_achats`, nom: 'Achats test', permissions });
  const compte = async (nom: string, activites: string[], site_ids: string[] = []) => {
    const email = `test.${nom}.${suffixe.toLowerCase()}@riz-de-niono.test`;
    await creer('/utilisateurs', { nom: `Test ${nom}`, email, mot_de_passe: MOT_DE_PASSE, role_id: role, activites, site_ids });
    return connecter(email, MOT_DE_PASSE);
  };
  jetonSiteA = await compte('achats-site-a', ['production'], [ref.siteA]);
  jetonTransformation = await compte('achats-transfo', ['transformation']);
});

after(async () => {
  serveur?.close();
  const base = mongoose.connection.db;
  if (!base) return;
  const motif = { $regex: `^${prefixe}` };
  const idsDe = async (collection: string, filtre: object) =>
    (await base.collection(collection).find(filtre, { projection: { _id: 1 } }).toArray()).map((d) => d._id);

  const fournisseurs = await idsDe('fournisseurs', { nom: motif });
  const achats = await idsDe('achats', { fournisseur_id: { $in: fournisseurs } });
  const campagnes = await idsDe('campagnes_agricoles', { code: motif });
  const produits = await idsDe('produits', { code: motif });
  const documents = [
    ...fournisseurs,
    ...achats,
    ...(await idsDe('reglements_fournisseurs', { achat_id: { $in: achats } })),
    ...(await idsDe('operations_agricoles', { campagne_id: { $in: campagnes } })),
    ...(await idsDe('mouvements_stock', { produit_id: { $in: produits } })),
  ];
  await base.collection('reglements_fournisseurs').deleteMany({ achat_id: { $in: achats } });
  await base.collection('achats').deleteMany({ _id: { $in: achats } });
  await base.collection('fournisseurs').deleteMany({ _id: { $in: fournisseurs } });
  await base.collection('operations_agricoles').deleteMany({ campagne_id: { $in: campagnes } });
  await base.collection('mouvements_stock').deleteMany({ produit_id: { $in: produits } });
  await base.collection('stocks').deleteMany({ produit_id: { $in: produits } });
  for (const collection of ['categories_produits', 'produits', 'sites_production', 'campagnes_agricoles', 'types_operations_agricoles', 'unites_transformation']) {
    documents.push(...(await idsDe(collection, { code: motif })));
    await base.collection(collection).deleteMany({ code: motif });
  }
  const utilisateurs = await idsDe('utilisateurs', { email: { $regex: '^test\\.' } });
  const roles = await idsDe('roles', { code: { $regex: '^test_' } });
  await base.collection('sessions').deleteMany({ utilisateur_id: { $in: utilisateurs } });
  await base.collection('journal_operations').deleteMany({ document_id: { $in: [...documents, ...utilisateurs, ...roles] } });
  await base.collection('utilisateurs').deleteMany({ _id: { $in: utilisateurs } });
  await base.collection('roles').deleteMany({ _id: { $in: roles } });
  await deconnecterMongo();
});

describe('Fournisseurs', () => {
  it('crée, liste, consulte, modifie et archive un fournisseur', async () => {
    const creation = attendu(
      await appel('POST', '/fournisseurs', jetonAdmin, { nom: `${prefixe} Agro Intrants`, telephone: '+223 70 00 00 00', adresse: 'Niono' }),
      201,
    );
    ref.fournisseur = creation.corps._id;
    assert.equal(creation.corps.actif, true);
    attendu(await appel('POST', '/fournisseurs', jetonAdmin, { telephone: '1' }), 422, 'donnees_invalides');
    assert.ok(attendu(await appel('GET', '/fournisseurs?actif=true&taille_page=100', jetonAdmin), 200).corps.items.some((f: { _id: string }) => f._id === ref.fournisseur));
    assert.equal(attendu(await appel('PATCH', `/fournisseurs/${ref.fournisseur}`, jetonAdmin, { telephone: null }), 200).corps.telephone, null);

    const archive = attendu(await appel('POST', '/fournisseurs', jetonAdmin, { nom: `${prefixe} Ancien fournisseur` }), 201).corps._id;
    assert.equal(attendu(await appel('PATCH', `/fournisseurs/${archive}`, jetonAdmin, { actif: false }), 200).corps.actif, false);
    attendu(
      await appel('POST', '/achats', jetonAdmin, { activite: 'production', fournisseur_id: archive, date_achat: '2026-06-10', lignes: [ligneTransport] }),
      422,
      'donnees_invalides',
    );
    assert.equal(attendu(await appel('GET', `/fournisseurs/${archive}`, jetonAgent), 403, 'acces_refuse').statut, 403);
  });
});

describe('Parcours fournisseur → achat → réception → stock → règlement → consommation', () => {
  it('enchaîne toutes les étapes avec les montants et soldes attendus', async () => {
    // Achat d'intrants : 50 sacs à 12 500 FCFA et une ligne de service (transport).
    const creation = attendu(await creerAchat({ site_id: ref.siteA, campagne_id: ref.campagne, lignes: [ligneEngrais('50'), ligneTransport] }), 201);
    const achat = creation.corps;
    assert.equal(achat.statut, 'brouillon');
    assert.equal(achat.statut_reception, null);
    assert.equal(achat.montant_total, '645000');
    assert.deepEqual(achat.lignes.map((l: { montant: string }) => l.montant), ['625000', '20000']);
    attendu(await appel('POST', `/achats/${achat._id}/reception`, jetonAdmin), 409, 'achat_non_valide');

    const validation = attendu(await appel('POST', `/achats/${achat._id}/validation`, jetonAdmin), 200);
    assert.equal(validation.corps.statut, 'validee');
    assert.equal(validation.corps.statut_reception, 'en_cours');
    assert.equal(await solde(ref.engrais), 0);

    // Réception depuis la fiche : entrée en stock de la seule ligne stockable.
    const reception = attendu(await appel('POST', `/achats/${achat._id}/reception`, jetonAdmin), 200);
    assert.equal(reception.corps.statut_reception, 'recu');
    assert.ok(reception.corps.recu_at);
    assert.equal(await solde(ref.engrais), 50);
    const mouvements = await mouvementsAchat(achat._id, ref.engrais);
    assert.equal(mouvements.length, 1);
    assert.equal(mouvements[0].sens, 'entree');
    assert.equal(mouvements[0].ligne_id, achat.lignes[0].ligne_id);
    assert.equal(attendu(await appel('POST', `/achats/${achat._id}/reception`, jetonAdmin), 200).corps.statut_reception, 'recu');
    assert.equal((await mouvementsAchat(achat._id, ref.engrais)).length, 1);

    // Règlement partiel : seul le règlement validé compte dans le montant réglé.
    const reglement = attendu(
      await appel('POST', '/reglements-fournisseurs', jetonAdmin, {
        achat_id: achat._id, date_paiement: '2026-06-15', montant: '200000', mode: 'mobile_money', reference: 'OM-123',
      }),
      201,
    );
    assert.equal(reglement.corps.statut, 'brouillon');
    assert.equal(reglement.corps.achat.solde_restant, '645000');
    const reglementValideReponse = attendu(await appel('POST', `/reglements-fournisseurs/${reglement.corps._id}/validation`, jetonAdmin), 200);
    assert.deepEqual(reglementValideReponse.corps.achat, { montant_total: '645000', montant_regle: '200000', solde_restant: '445000' });
    const fiche = attendu(await appel('GET', `/achats/${achat._id}`, jetonAdmin), 200);
    assert.equal(fiche.corps.montant_regle, '200000');
    assert.equal(fiche.corps.solde_restant, '445000');
    const reglements = attendu(await appel('GET', `/reglements-fournisseurs?achat_id=${achat._id}`, jetonAdmin), 200);
    assert.equal(reglements.corps.total, 1);
    assert.ok(attendu(await appel('GET', `/achats?fournisseur_id=${ref.fournisseur}&statut_reception=recu`, jetonAdmin), 200).corps.items.some((a: { _id: string }) => a._id === achat._id));

    // Consommation dans une opération agricole.
    const operation = attendu(
      await appel('POST', '/operations-agricoles', jetonAdmin, {
        campagne_id: ref.campagne, site_id: ref.siteA, type_operation_id: ref.typeOperation, date_operation: '2026-07-01',
        intrants: [{ produit_id: ref.engrais, quantite: '20' }],
      }),
      201,
    );
    attendu(await appel('POST', `/operations-agricoles/${operation.corps._id}/validation`, jetonAdmin), 200);
    assert.equal(await solde(ref.engrais), 30);
    ref.achatParcours = achat._id;
    ref.reglementParcours = reglement.corps._id;
  });
});

describe('Réception simultanée', () => {
  it('ne crée qu’une entrée par ligne pour deux réceptions simultanées', async () => {
    const avant = await solde(ref.uree);
    const id = await achatValide([
      { libelle: 'Urée lot 1', produit_id: ref.uree, quantite: '10', prix_unitaire: '15000' },
      { libelle: 'Urée lot 2', produit_id: ref.uree, quantite: '5', prix_unitaire: '15000' },
    ]);
    const reponses = await Promise.all([appel('POST', `/achats/${id}/reception`, jetonAdmin), appel('POST', `/achats/${id}/reception`, jetonAdmin)]);
    for (const reponse of reponses) assert.equal(attendu(reponse, 200).corps.statut_reception, 'recu');
    const mouvements = await mouvementsAchat(id, ref.uree);
    assert.equal(mouvements.length, 2);
    assert.equal(new Set(mouvements.map((m: { ligne_id: string }) => m.ligne_id)).size, 2);
    assert.equal(await solde(ref.uree), avant + 15);
  });
});

describe('Achat de service', () => {
  it('se valide et se règle sans réception ni mouvement de stock', async () => {
    const id = attendu(
      await creerAchat({ lignes: [ligneTransport, { libelle: 'Sacs vides', produit_id: ref.sacsVides, quantite: '100', prix_unitaire: '250' }] }),
      201,
    ).corps._id;
    const validation = attendu(await appel('POST', `/achats/${id}/validation`, jetonAdmin), 200);
    assert.equal(validation.corps.statut_reception, null);
    assert.equal(validation.corps.montant_total, '45000');
    attendu(await appel('POST', `/achats/${id}/reception`, jetonAdmin), 409, 'reception_sans_objet');

    await reglementValide(id, '45000');
    const fiche = attendu(await appel('GET', `/achats/${id}`, jetonAdmin), 200);
    assert.equal(fiche.corps.solde_restant, '0');
    const exces = attendu(
      await appel('POST', '/reglements-fournisseurs', jetonAdmin, { achat_id: id, date_paiement: '2026-06-21', montant: '1', mode: 'especes' }),
      201,
    );
    attendu(await appel('POST', `/reglements-fournisseurs/${exces.corps._id}/validation`, jetonAdmin), 409, 'montant_superieur_au_solde');
    assert.equal(attendu(await appel('GET', `/reglements-fournisseurs/${exces.corps._id}`, jetonAdmin), 200).corps.statut, 'brouillon');
    assert.equal(attendu(await appel('GET', `/achats/${id}`, jetonAdmin), 200).corps.montant_regle, '45000');
  });
});

describe('Annulations', () => {
  it('annule un brouillon d’achat et un brouillon de règlement', async () => {
    const brouillon = attendu(await creerAchat({ lignes: [ligneTransport] }), 201).corps._id;
    attendu(await appel('POST', '/reglements-fournisseurs', jetonAdmin, { achat_id: brouillon, date_paiement: '2026-06-20', montant: '1', mode: 'especes' }), 409, 'achat_non_valide');
    const annulation = attendu(await appel('POST', `/achats/${brouillon}/annulation`, jetonAdmin, { motif: 'Doublon' }), 200);
    assert.equal(annulation.corps.statut, 'annulee');
    attendu(await appel('POST', `/achats/${brouillon}/validation`, jetonAdmin), 409, 'transition_invalide');

    const achat = await achatValide([ligneTransport]);
    const reglement = attendu(
      await appel('POST', '/reglements-fournisseurs', jetonAdmin, { achat_id: achat, date_paiement: '2026-06-20', montant: '5000', mode: 'cheque' }),
      201,
    ).corps._id;
    assert.equal(attendu(await appel('PATCH', `/reglements-fournisseurs/${reglement}`, jetonAdmin, { montant: '6000' }), 200).corps.montant, '6000');
    assert.equal(attendu(await appel('POST', `/reglements-fournisseurs/${reglement}/annulation`, jetonAdmin, { motif: 'Erreur' }), 200).corps.statut, 'annulee');
    attendu(await appel('POST', `/reglements-fournisseurs/${reglement}/validation`, jetonAdmin), 409, 'transition_invalide');
  });

  it('exige l’annulation des règlements avant celle d’un achat réglé, puis contrepasse la réception', async () => {
    attendu(await appel('PATCH', `/achats/${ref.achatParcours}`, jetonAdmin, { date_achat: '2026-06-11' }), 409, 'operation_non_modifiable');
    attendu(await appel('PATCH', `/reglements-fournisseurs/${ref.reglementParcours}`, jetonAdmin, { montant: '1' }), 409, 'operation_non_modifiable');
    attendu(await appel('POST', `/achats/${ref.achatParcours}/annulation`, jetonAdmin, { motif: 'Retour fournisseur' }), 409, 'achat_regle');

    const correction = attendu(await appel('POST', `/reglements-fournisseurs/${ref.reglementParcours}/annulation`, jetonAdmin, { motif: 'Paiement rejeté' }), 200);
    assert.equal(correction.corps.statut, 'annulee');
    assert.deepEqual(correction.corps.achat, { montant_total: '645000', montant_regle: '0', solde_restant: '645000' });

    // 20 des 50 sacs ont été consommés : la sortie inverse de 50 est refusée, et rien ne change.
    attendu(await appel('POST', `/achats/${ref.achatParcours}/annulation`, jetonAdmin, { motif: 'Retour fournisseur' }), 409, 'stock_insuffisant');
    assert.equal(attendu(await appel('GET', `/achats/${ref.achatParcours}`, jetonAdmin), 200).corps.statut, 'validee');
    assert.equal(await solde(ref.engrais), 30);
  });

  it('contrepasse un achat reçu non consommé', async () => {
    const avant = await solde(ref.engrais);
    const id = await achatValide([ligneEngrais('8')], { recu: true });
    assert.equal(await solde(ref.engrais), avant + 8);
    const annulation = attendu(await appel('POST', `/achats/${id}/annulation`, jetonAdmin, { motif: 'Livraison refusée' }), 200);
    assert.equal(annulation.corps.statut, 'annulee');
    assert.equal(annulation.corps.statut_reception, 'recu');
    assert.equal(await solde(ref.engrais), avant);
    const mouvements = await mouvementsAchat(id, ref.engrais);
    assert.equal(mouvements.length, 2);
    assert.ok(mouvements.some((m: { sens: string; annule_mouvement_id: string | null }) => m.sens === 'sortie' && m.annule_mouvement_id));
  });
});

describe('Contrôles de saisie et périmètre', () => {
  it('contrôle les lignes et les rattachements selon l’activité', async () => {
    attendu(await creerAchat({ lignes: [] }), 422, 'donnees_invalides');
    attendu(await creerAchat({ lignes: [{ quantite: '1', prix_unitaire: '1' }] }), 422, 'donnees_invalides');
    attendu(await creerAchat({ lignes: [{ libelle: 'Riz', produit_id: ref.riz, quantite: '1', prix_unitaire: '1' }] }), 422, 'produit_non_achetable');
    attendu(await creerAchat({ site_id: ref.siteHors, campagne_id: ref.campagne, lignes: [ligneTransport] }), 422, 'site_hors_campagne');
    attendu(await creerAchat({ activite: 'commercialisation', site_id: ref.siteA, lignes: [ligneTransport] }), 422, 'donnees_invalides');
    const commercial = attendu(
      await creerAchat({ activite: 'commercialisation', lignes: [{ libelle: 'Riz', produit_id: ref.riz, quantite: '10', prix_unitaire: '400' }] }),
      201,
    );
    assert.equal(commercial.corps.activite, 'commercialisation');
    const parActivite = attendu(await appel('GET', '/achats?activite=commercialisation&taille_page=100', jetonAdmin), 200);
    assert.ok(parActivite.corps.items.every((a: { activite: string }) => a.activite === 'commercialisation'));
  });

  it('refuse les accès hors activité ou hors site', async () => {
    const achatB = await achatValide([ligneTransport], { site: ref.siteB });
    const reglementB = attendu(
      await appel('POST', '/reglements-fournisseurs', jetonAdmin, { achat_id: achatB, date_paiement: '2026-06-20', montant: '1000', mode: 'especes' }),
      201,
    ).corps._id;
    const achatSansSite = attendu(await creerAchat({ lignes: [ligneTransport] }), 201).corps._id;

    // Utilisateur limité au site A.
    attendu(await appel('GET', `/achats/${achatB}`, jetonSiteA), 404, 'ressource_introuvable');
    attendu(await appel('POST', `/achats/${achatB}/annulation`, jetonSiteA, { motif: 'X' }), 404, 'ressource_introuvable');
    attendu(await appel('GET', `/reglements-fournisseurs/${reglementB}`, jetonSiteA), 404, 'ressource_introuvable');
    attendu(await appel('POST', '/reglements-fournisseurs', jetonSiteA, { achat_id: achatB, date_paiement: '2026-06-20', montant: '1', mode: 'especes' }), 422, 'donnees_invalides');
    attendu(await creerAchat({ site_id: ref.siteB, lignes: [ligneTransport] }, jetonSiteA), 403, 'acces_refuse');
    assert.equal(attendu(await appel('GET', `/achats/${achatSansSite}`, jetonSiteA), 200).corps._id, achatSansSite);
    const visibles = attendu(await appel('GET', '/achats?taille_page=100', jetonSiteA), 200).corps.items;
    assert.ok(visibles.every((a: { site_id: string | null }) => a.site_id === null || a.site_id === ref.siteA));
    assert.ok(attendu(await appel('GET', '/reglements-fournisseurs?taille_page=100', jetonSiteA), 200).corps.items.every((r: { _id: string }) => r._id !== reglementB));
    const achatA = attendu(await creerAchat({ site_id: ref.siteA, lignes: [ligneEngrais('1')] }, jetonSiteA), 201);
    assert.equal(achatA.corps.site_id, ref.siteA);

    // Utilisateur de la transformation.
    attendu(await appel('GET', `/achats/${ref.achatParcours}`, jetonTransformation), 404, 'ressource_introuvable');
    attendu(await appel('GET', '/achats?activite=production', jetonTransformation), 403, 'acces_refuse');
    attendu(await creerAchat({ lignes: [ligneTransport] }, jetonTransformation), 403, 'acces_refuse');
    attendu(
      await creerAchat({ activite: 'transformation', unite_transformation_id: '64b000000000000000000002', lignes: [ligneTransport] }, jetonTransformation),
      422,
      'donnees_invalides',
    );
    const unite = attendu(await appel('POST', '/unites-transformation', jetonAdmin, { code: `${prefixe}-UT`, nom: 'Rizerie test' }), 201).corps._id;
    const transfo = attendu(
      await creerAchat({ activite: 'transformation', unite_transformation_id: unite, lignes: [ligneTransport] }, jetonTransformation),
      201,
    );
    assert.equal(transfo.corps.unite_transformation_id, unite);

    // Filtre activite des règlements : même règle de périmètre que pour les achats.
    const reglementsProduction = attendu(await appel('GET', '/reglements-fournisseurs?activite=production&taille_page=100', jetonAdmin), 200).corps.items;
    assert.ok(reglementsProduction.length > 0);
    assert.ok(reglementsProduction.every((r: { activite: string }) => r.activite === 'production'));
    assert.ok(reglementsProduction.some((r: { _id: string }) => r._id === reglementB));
    const reglementsTransformation = attendu(await appel('GET', '/reglements-fournisseurs?activite=transformation&taille_page=100', jetonAdmin), 200).corps.items;
    assert.ok(reglementsTransformation.every((r: { _id: string; activite: string }) => r.activite === 'transformation' && r._id !== reglementB));
    attendu(await appel('GET', '/reglements-fournisseurs?activite=production', jetonTransformation), 403, 'acces_refuse');
    attendu(await appel('GET', '/reglements-fournisseurs?activite=inconnue', jetonAdmin), 422, 'donnees_invalides');

    // Agent sans droit sur les achats.
    attendu(await appel('GET', '/achats', jetonAgent), 403, 'acces_refuse');
  });
});
