/**
 * Tests d'intégration des modules Clients, Commandes clients, Ventes, Encaissements et Retours clients
 * sur la base Atlas de tests : transformation validée → commande livrée → vente créée → paiement partiel →
 * retour après paiement (trop-perçu), stock insuffisant, livraison simultanée, vente directe et périmètre.
 * Les données créées portent le préfixe « TST-<suffixe> » et sont supprimées à la fin.
 * Utilisation : npm run test:commercialisation
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
const MOT_DE_PASSE = 'Commercialisation-2026!';

let serveur: Server;
let urlApi: string;
let jetonAdmin: string;
let jetonAgent: string;
let jetonCommercial: string;
let jetonProduction: string;
let jetonTransfo: string;
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

async function creerCommande(lignes: unknown[], client = ref.client): Promise<Reponse> {
  return appel('POST', '/commandes-clients', jetonCommercial, { client_id: client, date_commande: '2026-11-10', lignes });
}

async function encaissementValide(venteId: string, montant: string, jeton = jetonCommercial): Promise<Reponse> {
  const id = attendu(
    await appel('POST', '/encaissements', jeton, { vente_id: venteId, date_paiement: '2026-11-12', montant, mode: 'mobile_money', reference: 'OM-1' }),
    201,
  ).corps._id;
  return appel('POST', `/encaissements/${id}/validation`, jeton);
}

before(async () => {
  await connecterMongo(configuration.mongodbBaseTests);
  const { administrateur, limite } = await initialiserComptesTests();
  serveur = creerApplication().listen(0);
  urlApi = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}/api/v1`;
  jetonAdmin = await connecter(administrateur.email, administrateur.mot_de_passe);
  jetonAgent = await connecter(limite.email, limite.mot_de_passe);

  const creer = async (chemin: string, corps: unknown) => attendu(await appel('POST', chemin, jetonAdmin, corps), 201).corps._id as string;
  ref.categorie = await creer('/categories-produits', { code: `${prefixe}-CAT`, nom: 'Riz' });
  const produit = (code: string, activites: string[], extra: object = {}) =>
    creer('/produits', { code: `${prefixe}-${code}`, nom: code, categorie_id: ref.categorie, unite_stock: 'kg', activites, ...extra });
  ref.paddy = await produit('PADDY', ['production', 'transformation']);
  ref.riz = await produit('RIZ', ['transformation', 'commercialisation'], { prix_vente: '450' });
  ref.son = await produit('SON', ['transformation', 'commercialisation']);
  ref.unite = await creer('/unites-transformation', { code: `${prefixe}-UT`, nom: 'Rizerie' });
  ref.fournisseur = await creer('/fournisseurs', { nom: `${prefixe} Coopérative` });

  const permissions = [
    ...['clients', 'commandes_clients', 'ventes', 'encaissements', 'retours_clients'].flatMap((module) =>
      ['consultation', 'saisie', 'validation'].map((action) => ({ module, action })),
    ),
    { module: 'stock', action: 'consultation' },
  ];
  const role = await creer('/roles', { code: `test_${suffixe.toLowerCase()}_commercial`, nom: 'Commercial test', permissions });
  const compte = async (nom: string, activites: string[]) => {
    const email = `test.${nom}.${suffixe.toLowerCase()}@riz-de-niono.test`;
    await creer('/utilisateurs', { nom: `Test ${nom}`, email, mot_de_passe: MOT_DE_PASSE, role_id: role, activites });
    return connecter(email, MOT_DE_PASSE);
  };
  jetonCommercial = await compte('commercial', ['commercialisation']);
  jetonProduction = await compte('vente-production', ['production']);
  jetonTransfo = await compte('vente-transfo', ['transformation']);
});

after(async () => {
  serveur?.close();
  const base = mongoose.connection.db;
  if (!base) return;
  const motif = { $regex: `^${prefixe}` };
  const idsDe = async (collection: string, filtre: object) =>
    (await base.collection(collection).find(filtre, { projection: { _id: 1 } }).toArray()).map((d) => d._id);

  const clients = await idsDe('clients', { nom: motif });
  const ventes = await idsDe('ventes', { client_id: { $in: clients } });
  const commandes = await idsDe('commandes_clients', { client_id: { $in: clients } });
  const unites = await idsDe('unites_transformation', { code: motif });
  const fournisseurs = await idsDe('fournisseurs', { nom: motif });
  const achats = await idsDe('achats', { fournisseur_id: { $in: fournisseurs } });
  const produits = await idsDe('produits', { code: motif });
  const documents = [
    ...clients, ...ventes, ...commandes, ...unites, ...fournisseurs, ...achats,
    ...(await idsDe('encaissements', { vente_id: { $in: ventes } })),
    ...(await idsDe('retours_clients', { vente_id: { $in: ventes } })),
    ...(await idsDe('operations_transformation', { unite_transformation_id: { $in: unites } })),
    ...(await idsDe('mouvements_stock', { produit_id: { $in: produits } })),
  ];
  await base.collection('encaissements').deleteMany({ vente_id: { $in: ventes } });
  await base.collection('retours_clients').deleteMany({ vente_id: { $in: ventes } });
  await base.collection('ventes').deleteMany({ _id: { $in: ventes } });
  await base.collection('commandes_clients').deleteMany({ _id: { $in: commandes } });
  await base.collection('clients').deleteMany({ _id: { $in: clients } });
  await base.collection('operations_transformation').deleteMany({ unite_transformation_id: { $in: unites } });
  await base.collection('achats').deleteMany({ _id: { $in: achats } });
  await base.collection('fournisseurs').deleteMany({ _id: { $in: fournisseurs } });
  await base.collection('mouvements_stock').deleteMany({ produit_id: { $in: produits } });
  await base.collection('stocks').deleteMany({ produit_id: { $in: produits } });
  for (const collection of ['categories_produits', 'produits', 'unites_transformation']) {
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

describe('Clients', () => {
  it('crée, liste, consulte, modifie et archive une fiche client', async () => {
    const creation = attendu(await appel('POST', '/clients', jetonCommercial, { nom: `${prefixe} Grossiste Ségou`, telephone: '+223 76 00 00 00' }), 201);
    ref.client = creation.corps._id;
    assert.deepEqual(creation.corps.ventes, { montant_total: '0', montant_encaisse: '0', montant_retours: '0', solde: '0', trop_percu: '0' });
    assert.ok(attendu(await appel('GET', '/clients?actif=true&taille_page=100', jetonCommercial), 200).corps.items.some((c: { _id: string }) => c._id === ref.client));
    assert.equal(attendu(await appel('PATCH', `/clients/${ref.client}`, jetonCommercial, { adresse: 'Ségou' }), 200).corps.adresse, 'Ségou');

    const archive = attendu(await appel('POST', '/clients', jetonCommercial, { nom: `${prefixe} Ancien client` }), 201).corps._id;
    assert.equal(attendu(await appel('PATCH', `/clients/${archive}`, jetonCommercial, { actif: false }), 200).corps.actif, false);
    attendu(await creerCommande([{ produit_id: ref.riz, quantite: '1' }], archive), 422, 'donnees_invalides');
  });
});

describe('Parcours transformation → commande livrée → vente → paiement → retour', () => {
  it('prépare le riz par une transformation validée', async () => {
    const achat = attendu(
      await appel('POST', '/achats', jetonAdmin, {
        activite: 'transformation', fournisseur_id: ref.fournisseur, date_achat: '2026-11-01', unite_transformation_id: ref.unite,
        lignes: [{ libelle: 'Paddy', produit_id: ref.paddy, quantite: '1200', prix_unitaire: '180' }],
      }),
      201,
    ).corps._id;
    attendu(await appel('POST', `/achats/${achat}/validation`, jetonAdmin), 200);
    attendu(await appel('POST', `/achats/${achat}/reception`, jetonAdmin), 200);
    const operation = attendu(
      await appel('POST', '/operations-transformation', jetonAdmin, {
        unite_transformation_id: ref.unite, date_operation: '2026-11-05', paddy_produit_id: ref.paddy, quantite_paddy: '1000',
        resultats: [{ produit_id: ref.riz, quantite: '650' }, { produit_id: ref.son, quantite: '150' }],
      }),
      201,
    ).corps._id;
    attendu(await appel('POST', `/operations-transformation/${operation}/validation`, jetonAdmin), 200);
    assert.equal(await solde(ref.riz), 650);
    assert.equal(await solde(ref.son), 150);
  });

  it('livre une commande : vente créée aux prix de la commande et stock diminué une seule fois', async () => {
    attendu(await creerCommande([{ produit_id: ref.son, quantite: '1' }]), 422, 'prix_manquant');
    const creation = attendu(await creerCommande([{ produit_id: ref.riz, quantite: '250' }, { produit_id: ref.son, quantite: '100', prix_unitaire: '120' }]), 201);
    const commande = creation.corps;
    assert.equal(commande.statut, 'en_cours');
    assert.equal(commande.lignes[0].prix_unitaire, '450');
    const modification = attendu(
      await appel('PATCH', `/commandes-clients/${commande._id}`, jetonCommercial, {
        lignes: [{ produit_id: ref.riz, quantite: '300' }, { produit_id: ref.son, quantite: '100', prix_unitaire: '120' }],
      }),
      200,
    );
    assert.equal(modification.corps.montant_total, '147000');

    assert.equal(attendu(await appel('POST', `/commandes-clients/${commande._id}/expedition`, jetonCommercial), 200).corps.statut, 'en_expedition');
    attendu(await appel('PATCH', `/commandes-clients/${commande._id}`, jetonCommercial, { date_commande: '2026-11-11' }), 409, 'operation_non_modifiable');

    const livraison = attendu(await appel('POST', `/commandes-clients/${commande._id}/livraison`, jetonCommercial), 200);
    const vente = livraison.corps.vente;
    assert.equal(livraison.corps.commande.statut, 'livree');
    assert.equal(livraison.corps.commande.vente_id, vente._id);
    assert.equal(vente.statut, 'validee');
    assert.equal(vente.commande_id, commande._id);
    assert.equal(vente.activite, 'commercialisation');
    assert.deepEqual(vente.lignes.map((l: { prix_unitaire: string }) => l.prix_unitaire), ['450', '120']);
    assert.equal(vente.montant_total, '147000');
    assert.equal(vente.solde, '147000');
    assert.equal(await solde(ref.riz), 350);
    assert.equal(await solde(ref.son), 50);

    // Un changement de prix catalogue ne modifie pas le prix appliqué.
    attendu(await appel('PATCH', `/produits/${ref.riz}`, jetonAdmin, { prix_vente: '500' }), 200);
    assert.equal(attendu(await appel('GET', `/ventes/${vente._id}`, jetonCommercial), 200).corps.lignes[0].prix_unitaire, '450');

    const repetition = attendu(await appel('POST', `/commandes-clients/${commande._id}/livraison`, jetonCommercial), 200);
    assert.equal(repetition.corps.vente._id, vente._id);
    assert.equal(await solde(ref.riz), 350);
    const mouvements = attendu(await appel('GET', `/mouvements-stock?produit_id=${ref.riz}&origine_type=vente&taille_page=100`, jetonAdmin), 200);
    assert.equal(mouvements.corps.items.filter((m: { origine_id: string }) => m.origine_id === vente._id).length, 1);
    attendu(await appel('POST', `/commandes-clients/${commande._id}/annulation`, jetonCommercial), 409, 'commande_livree');
    attendu(await appel('POST', `/ventes/${vente._id}/annulation`, jetonCommercial, { motif: 'X' }), 409, 'vente_de_commande');
    ref.vente = vente._id;
    ref.ligneRiz = vente.lignes[0].ligne_id;
  });

  it('enregistre un paiement partiel et refuse un encaissement supérieur au solde', async () => {
    const paiement = attendu(await encaissementValide(ref.vente, '100000'), 200);
    assert.equal(paiement.corps.statut, 'validee');
    assert.equal(paiement.corps.vente.montant_encaisse, '100000');
    assert.equal(paiement.corps.vente.solde, '47000');
    attendu(await encaissementValide(ref.vente, '50000'), 409, 'montant_superieur_au_solde');
    const fiche = attendu(await appel('GET', `/ventes/${ref.vente}`, jetonCommercial), 200).corps;
    assert.equal(fiche.montant_encaisse, '100000');
    assert.equal(fiche.solde, '47000');
    assert.equal(attendu(await appel('GET', `/encaissements?vente_id=${ref.vente}`, jetonCommercial), 200).corps.total, 2);
  });

  it('enregistre un retour après paiement : stock revendable, solde recalculé et trop-perçu affiché', async () => {
    const retour = attendu(
      await appel('POST', '/retours-clients', jetonCommercial, {
        vente_id: ref.vente, date_retour: '2026-11-13',
        lignes: [{ ligne_vente_id: ref.ligneRiz, quantite: '200', quantite_revendable: '150', motif: 'Sacs abîmés au transport' }],
      }),
      201,
    );
    assert.equal(retour.corps.montant, '90000');
    assert.equal(retour.corps.statut, 'brouillon');
    const validation = attendu(await appel('POST', `/retours-clients/${retour.corps._id}/validation`, jetonCommercial), 200);
    assert.deepEqual(validation.corps.vente, {
      montant_total: '147000', montant_encaisse: '100000', montant_retours: '90000', solde: '-43000', trop_percu: '43000',
    });
    assert.equal(await solde(ref.riz), 500);
    const vente = attendu(await appel('GET', `/ventes/${ref.vente}`, jetonCommercial), 200).corps;
    assert.equal(vente.lignes[0].quantite_retournee, '200');
    assert.equal(attendu(await appel('GET', `/clients/${ref.client}`, jetonCommercial), 200).corps.ventes.trop_percu, '43000');
    ref.retourValide = retour.corps._id;
  });

  it('limite le cumul des retours à la quantité vendue', async () => {
    const ligne = (quantite: string) => ({ vente_id: ref.vente, date_retour: '2026-11-14', lignes: [{ ligne_vente_id: ref.ligneRiz, quantite, quantite_revendable: '0', motif: 'Défaut' }] });
    attendu(await appel('POST', '/retours-clients', jetonCommercial, ligne('150')), 422, 'donnees_invalides');
    attendu(
      await appel('POST', '/retours-clients', jetonCommercial, { ...ligne('10'), lignes: [{ ligne_vente_id: ref.ligneRiz, quantite: '10', quantite_revendable: '11', motif: 'X' }] }),
      422,
      'donnees_invalides',
    );
    const premier = attendu(await appel('POST', '/retours-clients', jetonCommercial, ligne('80')), 201).corps._id;
    const second = attendu(await appel('POST', '/retours-clients', jetonCommercial, ligne('80')), 201).corps._id;
    attendu(await appel('POST', `/retours-clients/${premier}/validation`, jetonCommercial), 200);
    attendu(await appel('POST', `/retours-clients/${second}/validation`, jetonCommercial), 409, 'quantite_retour_depassee');
    assert.equal(attendu(await appel('GET', `/retours-clients/${second}`, jetonCommercial), 200).corps.statut, 'brouillon');
    assert.equal(attendu(await appel('GET', `/ventes/${ref.vente}`, jetonCommercial), 200).corps.lignes[0].quantite_retournee, '280');

    // Annuler un retour validé le contrepasse : stock revendable ressorti et montant retiré.
    const annulation = attendu(await appel('POST', `/retours-clients/${ref.retourValide}/annulation`, jetonCommercial, { motif: 'Retour refusé' }), 200);
    assert.equal(annulation.corps.statut, 'annulee');
    assert.equal(annulation.corps.vente.montant_retours, '36000');
    assert.equal(await solde(ref.riz), 350);
    assert.equal(attendu(await appel('GET', `/ventes/${ref.vente}`, jetonCommercial), 200).corps.lignes[0].quantite_retournee, '80');
  });
});

describe('Stock insuffisant et livraison simultanée', () => {
  it('refuse une livraison sans stock suffisant et ne change rien', async () => {
    const commande = attendu(await creerCommande([{ produit_id: ref.riz, quantite: '10000' }]), 201).corps._id;
    const refus = attendu(await appel('POST', `/commandes-clients/${commande}/livraison`, jetonCommercial), 409, 'stock_insuffisant');
    assert.equal(refus.corps.erreur.details.produit_id, ref.riz);
    assert.equal(attendu(await appel('GET', `/commandes-clients/${commande}`, jetonCommercial), 200).corps.statut, 'en_cours');
    assert.equal(attendu(await appel('GET', `/ventes?commande_id=${commande}`, jetonCommercial), 200).corps.total, 0);
    assert.equal(await solde(ref.riz), 350);

    const annulee = attendu(await appel('POST', `/commandes-clients/${commande}/annulation`, jetonCommercial), 200);
    assert.equal(annulee.corps.statut, 'annulee');
    attendu(await appel('POST', `/commandes-clients/${commande}/livraison`, jetonCommercial), 409, 'transition_invalide');
  });

  it('renvoie la même vente pour deux livraisons simultanées et ne sort le stock qu’une fois', async () => {
    const commande = attendu(await creerCommande([{ produit_id: ref.riz, quantite: '10' }]), 201).corps._id;
    const reponses = await Promise.all([
      appel('POST', `/commandes-clients/${commande}/livraison`, jetonCommercial),
      appel('POST', `/commandes-clients/${commande}/livraison`, jetonCommercial),
    ]);
    for (const reponse of reponses) attendu(reponse, 200);
    assert.equal(reponses[0].corps.vente._id, reponses[1].corps.vente._id);
    assert.equal(attendu(await appel('GET', `/ventes?commande_id=${commande}`, jetonCommercial), 200).corps.total, 1);
    assert.equal(await solde(ref.riz), 340);
  });
});

describe('Vente directe', () => {
  it('sort le stock à la validation et se contrepasse à l’annulation', async () => {
    const lignes = [{ produit_id: ref.paddy, quantite: '50', prix_unitaire: '200' }];
    attendu(await appel('POST', '/ventes', jetonProduction, { client_id: ref.client, activite: 'commercialisation', date_vente: '2026-11-15', lignes }), 403, 'acces_refuse');
    attendu(await appel('POST', '/ventes', jetonProduction, { client_id: ref.client, activite: 'transformation', date_vente: '2026-11-15', lignes }), 422, 'donnees_invalides');
    const creation = attendu(await appel('POST', '/ventes', jetonProduction, { client_id: ref.client, activite: 'production', date_vente: '2026-11-15', lignes }), 201);
    const vente = creation.corps;
    assert.equal(vente.statut, 'brouillon');
    assert.equal(vente.montant_total, '10000');
    assert.equal(await solde(ref.paddy), 200);
    assert.equal(attendu(await appel('PATCH', `/ventes/${vente._id}`, jetonProduction, { lignes: [{ produit_id: ref.paddy, quantite: '60', prix_unitaire: '200' }] }), 200).corps.montant_total, '12000');

    assert.equal(attendu(await appel('POST', `/ventes/${vente._id}/validation`, jetonProduction), 200).corps.statut, 'validee');
    assert.equal(await solde(ref.paddy), 140);
    assert.equal(attendu(await appel('POST', `/ventes/${vente._id}/validation`, jetonProduction), 200).corps.statut, 'validee');
    assert.equal(await solde(ref.paddy), 140);
    attendu(await appel('PATCH', `/ventes/${vente._id}`, jetonProduction, { date_vente: '2026-11-16' }), 409, 'operation_non_modifiable');

    // Une vente encaissée ne s'annule qu'après l'annulation de ses encaissements.
    const encaissement = attendu(await appel('POST', '/encaissements', jetonProduction, { vente_id: vente._id, date_paiement: '2026-11-15', montant: '2000', mode: 'especes' }), 201).corps._id;
    attendu(await appel('POST', `/encaissements/${encaissement}/validation`, jetonProduction), 200);
    attendu(await appel('POST', `/ventes/${vente._id}/annulation`, jetonProduction, { motif: 'Erreur' }), 409, 'vente_encaissee');
    assert.equal(attendu(await appel('POST', `/encaissements/${encaissement}/annulation`, jetonProduction, { motif: 'Remboursé' }), 200).corps.vente.montant_encaisse, '0');

    const annulation = attendu(await appel('POST', `/ventes/${vente._id}/annulation`, jetonProduction, { motif: 'Client parti' }), 200);
    assert.equal(annulation.corps.statut, 'annulee');
    assert.equal(await solde(ref.paddy), 200);
    attendu(await appel('POST', '/encaissements', jetonProduction, { vente_id: vente._id, date_paiement: '2026-11-15', montant: '1', mode: 'especes' }), 409, 'vente_non_valide');
  });
});

describe('Périmètre', () => {
  it('refuse les accès hors activité ou sans permission', async () => {
    // Utilisateur de la production : pas de commandes, pas de ventes commerciales.
    attendu(await appel('GET', '/commandes-clients', jetonProduction), 403, 'acces_refuse');
    attendu(await appel('GET', `/ventes/${ref.vente}`, jetonProduction), 404, 'ressource_introuvable');
    attendu(await appel('GET', '/ventes?activite=commercialisation', jetonProduction), 403, 'acces_refuse');
    assert.ok(attendu(await appel('GET', '/ventes?taille_page=100', jetonProduction), 200).corps.items.every((v: { activite: string }) => v.activite === 'production'));
    attendu(await appel('POST', '/encaissements', jetonProduction, { vente_id: ref.vente, date_paiement: '2026-11-15', montant: '1', mode: 'especes' }), 422, 'donnees_invalides');
    assert.equal(attendu(await appel('GET', `/encaissements?vente_id=${ref.vente}`, jetonProduction), 200).corps.total, 0);
    attendu(await appel('GET', `/retours-clients/${ref.retourValide}`, jetonProduction), 404, 'ressource_introuvable');

    // Filtre activite des encaissements et retours : même règle que les règlements fournisseurs.
    type Ecriture = { _id: string; activite: string };
    const lister = async (chemin: string, jeton = jetonAdmin) => attendu(await appel('GET', chemin, jeton), 200).corps.items as Ecriture[];
    const commerciaux = await lister('/encaissements?activite=commercialisation&taille_page=100');
    assert.ok(commerciaux.length > 0 && commerciaux.every((e) => e.activite === 'commercialisation'));
    const deProduction = await lister('/encaissements?activite=production&taille_page=100');
    assert.ok(deProduction.length > 0 && deProduction.every((e) => e.activite === 'production'));
    // Combiné à vente_id : les deux filtres s'appliquent.
    assert.equal((await lister(`/encaissements?activite=commercialisation&vente_id=${ref.vente}`)).length, 2);
    assert.equal((await lister(`/encaissements?activite=production&vente_id=${ref.vente}`)).length, 0);
    const retoursCommerciaux = await lister('/retours-clients?activite=commercialisation&taille_page=100');
    assert.ok(retoursCommerciaux.some((r) => r._id === ref.retourValide) && retoursCommerciaux.every((r) => r.activite === 'commercialisation'));
    assert.ok((await lister('/retours-clients?activite=production&taille_page=100')).every((r) => r._id !== ref.retourValide));
    assert.equal((await lister(`/retours-clients?activite=commercialisation&vente_id=${ref.vente}`)).length > 0, true);
    for (const chemin of ['/encaissements', '/retours-clients']) {
      attendu(await appel('GET', `${chemin}?activite=commercialisation`, jetonProduction), 403, 'acces_refuse');
      attendu(await appel('GET', `${chemin}?activite=inconnue`, jetonAdmin), 422, 'donnees_invalides');
    }

    // Utilisateur de la transformation : aucun module commercial.
    for (const chemin of ['/clients', '/ventes', '/encaissements', '/retours-clients', '/commandes-clients']) {
      attendu(await appel('GET', chemin, jetonTransfo), 403, 'acces_refuse');
    }
    // Agent de production sans permission sur les ventes.
    attendu(await appel('GET', '/ventes', jetonAgent), 403, 'acces_refuse');
    attendu(await appel('GET', '/clients'), 401, 'session_invalide');
  });
});
