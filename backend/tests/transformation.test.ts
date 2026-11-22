/**
 * Tests d'intégration des modules Unités de transformation et Opérations de transformation sur la base
 * Atlas de tests : paddy entré par une récolte validée et par un achat reçu → transformation validée →
 * paddy diminué, riz et sous-produits augmentés ; stock insuffisant, validations simultanées, annulation,
 * périmètre et unités archivées. Les données créées portent le préfixe « TST-<suffixe> » et sont supprimées à la fin.
 * Utilisation : npm run test:transformation
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
const MOT_DE_PASSE = 'Transformation-2026!';

let serveur: Server;
let urlApi: string;
let jetonAdmin: string;
let jetonAgent: string;
let jetonTransfo: string;
let jetonProduction: string;
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

async function mouvementsOperation(operationId: string, produitId: string) {
  const reponse = attendu(
    await appel('GET', `/mouvements-stock?produit_id=${produitId}&origine_type=operation_transformation&taille_page=100`, jetonAdmin),
    200,
  );
  return reponse.corps.items.filter((m: { origine_id: string }) => m.origine_id === operationId);
}

/** Opération de transformation créée en brouillon par l'utilisateur de la transformation. */
async function creerOperation(quantitePaddy: string, resultats: { produit_id: string; quantite: string }[], jeton = jetonTransfo): Promise<Reponse> {
  return appel('POST', '/operations-transformation', jeton, {
    unite_transformation_id: ref.unite,
    date_operation: '2026-11-05',
    paddy_produit_id: ref.paddy,
    quantite_paddy: quantitePaddy,
    resultats,
    note_ecart: 'Pertes au décorticage',
  });
}

before(async () => {
  await connecterMongo(configuration.mongodbBaseTests);
  const { administrateur, limite } = await initialiserComptesTests();
  serveur = creerApplication().listen(0);
  urlApi = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}/api/v1`;
  jetonAdmin = await connecter(administrateur.email, administrateur.mot_de_passe);
  jetonAgent = await connecter(limite.email, limite.mot_de_passe);

  const creer = async (chemin: string, corps: unknown) => attendu(await appel('POST', chemin, jetonAdmin, corps), 201).corps._id as string;
  ref.categorie = await creer('/categories-produits', { code: `${prefixe}-CAT`, nom: 'Riz et sous-produits' });
  const produit = (code: string, activites: string[]) =>
    creer('/produits', { code: `${prefixe}-${code}`, nom: code, categorie_id: ref.categorie, unite_stock: 'kg', activites });
  ref.paddy = await produit('PADDY', ['production', 'transformation']);
  ref.riz = await produit('RIZ', ['transformation', 'commercialisation']);
  ref.son = await produit('SON', ['transformation']);
  ref.brisures = await produit('BRISURES', ['transformation']);
  ref.engrais = await produit('NPK', ['production']);
  ref.fournisseur = await creer('/fournisseurs', { nom: `${prefixe} Coopérative` });
  ref.site = await creer('/sites-production', { code: `${prefixe}-A`, nom: 'Site A' });
  ref.campagne = await creer('/campagnes-agricoles', {
    code: `${prefixe}-HIV`, nom: 'Hivernage', date_debut: '2026-06-01', date_fin: '2026-12-31', site_ids: [ref.site],
  });
  attendu(await appel('POST', `/campagnes-agricoles/${ref.campagne}/ouverture`, jetonAdmin), 200);

  const permissions = [
    ...['unites_transformation', 'operations_transformation', 'achats'].flatMap((module) =>
      ['consultation', 'saisie', 'validation'].map((action) => ({ module, action })),
    ),
    { module: 'stock', action: 'consultation' },
  ];
  const role = await creer('/roles', { code: `test_${suffixe.toLowerCase()}_transfo`, nom: 'Transformation test', permissions });
  const compte = async (nom: string, activites: string[]) => {
    const email = `test.${nom}.${suffixe.toLowerCase()}@riz-de-niono.test`;
    await creer('/utilisateurs', { nom: `Test ${nom}`, email, mot_de_passe: MOT_DE_PASSE, role_id: role, activites });
    return connecter(email, MOT_DE_PASSE);
  };
  jetonTransfo = await compte('transfo', ['transformation']);
  jetonProduction = await compte('prod-seule', ['production']);
});

after(async () => {
  serveur?.close();
  const base = mongoose.connection.db;
  if (!base) return;
  const motif = { $regex: `^${prefixe}` };
  const idsDe = async (collection: string, filtre: object) =>
    (await base.collection(collection).find(filtre, { projection: { _id: 1 } }).toArray()).map((d) => d._id);

  const unites = await idsDe('unites_transformation', { code: motif });
  const fournisseurs = await idsDe('fournisseurs', { nom: motif });
  const campagnes = await idsDe('campagnes_agricoles', { code: motif });
  const produits = await idsDe('produits', { code: motif });
  const achats = await idsDe('achats', { fournisseur_id: { $in: fournisseurs } });
  const documents = [
    ...unites,
    ...fournisseurs,
    ...achats,
    ...(await idsDe('operations_transformation', { unite_transformation_id: { $in: unites } })),
    ...(await idsDe('productions', { campagne_id: { $in: campagnes } })),
    ...(await idsDe('mouvements_stock', { produit_id: { $in: produits } })),
  ];
  await base.collection('operations_transformation').deleteMany({ unite_transformation_id: { $in: unites } });
  await base.collection('achats').deleteMany({ _id: { $in: achats } });
  await base.collection('fournisseurs').deleteMany({ _id: { $in: fournisseurs } });
  const clients = await idsDe('clients', { nom: motif });
  const commandes = await idsDe('commandes_clients', { client_id: { $in: clients } });
  const ventes = await idsDe('ventes', { client_id: { $in: clients } });
  documents.push(...clients, ...commandes, ...ventes);
  await base.collection('ventes').deleteMany({ _id: { $in: ventes } });
  await base.collection('commandes_clients').deleteMany({ _id: { $in: commandes } });
  await base.collection('clients').deleteMany({ _id: { $in: clients } });
  await base.collection('productions').deleteMany({ campagne_id: { $in: campagnes } });
  await base.collection('mouvements_stock').deleteMany({ produit_id: { $in: produits } });
  await base.collection('stocks').deleteMany({ produit_id: { $in: produits } });
  for (const collection of ['categories_produits', 'produits', 'sites_production', 'campagnes_agricoles', 'unites_transformation']) {
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

describe('Unités de transformation', () => {
  it('crée, liste, consulte, modifie et archive une unité', async () => {
    const creation = attendu(await appel('POST', '/unites-transformation', jetonTransfo, { code: `${prefixe}-rz1`.toLowerCase(), nom: 'Rizerie de Niono', localisation: 'Niono' }), 201);
    assert.equal(creation.corps.code, `${prefixe}-RZ1`);
    ref.unite = creation.corps._id;
    attendu(await appel('POST', '/unites-transformation', jetonTransfo, { code: `${prefixe}-RZ1`, nom: 'Doublon' }), 409, 'code_deja_utilise');
    assert.ok(attendu(await appel('GET', '/unites-transformation?actif=true&taille_page=100', jetonTransfo), 200).corps.items.some((u: { _id: string }) => u._id === ref.unite));
    assert.equal(attendu(await appel('PATCH', `/unites-transformation/${ref.unite}`, jetonTransfo, { localisation: null }), 200).corps.localisation, null);
    assert.equal(attendu(await appel('GET', `/unites-transformation/${ref.unite}`, jetonTransfo), 200).corps.nom, 'Rizerie de Niono');
  });

  it('refuse une unité archivée pour une nouvelle affectation et préserve les achats historiques', async () => {
    const ancienne = attendu(await appel('POST', '/unites-transformation', jetonTransfo, { code: `${prefixe}-RZ2`, nom: 'Ancienne rizerie' }), 201).corps._id;
    const achat = attendu(
      await appel('POST', '/achats', jetonTransfo, {
        activite: 'transformation', fournisseur_id: ref.fournisseur, date_achat: '2026-10-01', unite_transformation_id: ancienne,
        lignes: [{ libelle: 'Entretien décortiqueuse', quantite: '1', prix_unitaire: '50000' }],
      }),
      201,
    ).corps._id;
    assert.equal(attendu(await appel('PATCH', `/unites-transformation/${ancienne}`, jetonTransfo, { actif: false }), 200).corps.actif, false);

    // L'achat déjà lié reste consultable, modifiable et validable.
    assert.equal(attendu(await appel('GET', `/achats/${achat}`, jetonTransfo), 200).corps.unite_transformation_id, ancienne);
    assert.equal(attendu(await appel('PATCH', `/achats/${achat}`, jetonTransfo, { date_achat: '2026-10-02' }), 200).corps.unite_transformation_id, ancienne);
    assert.equal(attendu(await appel('POST', `/achats/${achat}/validation`, jetonTransfo), 200).corps.statut, 'validee');

    // Nouvelle affectation : refusée pour une unité archivée ou inconnue.
    const nouvelAchat = { activite: 'transformation', fournisseur_id: ref.fournisseur, date_achat: '2026-10-01', lignes: [{ libelle: 'Pièces', quantite: '1', prix_unitaire: '1000' }] };
    attendu(await appel('POST', '/achats', jetonTransfo, { ...nouvelAchat, unite_transformation_id: ancienne }), 422, 'donnees_invalides');
    attendu(await appel('POST', '/achats', jetonTransfo, { ...nouvelAchat, unite_transformation_id: '64b000000000000000000003' }), 422, 'donnees_invalides');
    attendu(
      await appel('POST', '/operations-transformation', jetonTransfo, {
        unite_transformation_id: ancienne, date_operation: '2026-11-01', paddy_produit_id: ref.paddy, quantite_paddy: '1', resultats: [{ produit_id: ref.riz, quantite: '1' }],
      }),
      422,
      'donnees_invalides',
    );
  });
});

describe('Parcours paddy → transformation → riz', () => {
  it('fait entrer le paddy par une récolte validée et par un achat reçu', async () => {
    const recolte = attendu(
      await appel('POST', '/productions', jetonAdmin, {
        campagne_id: ref.campagne, site_id: ref.site, produit_id: ref.paddy, date_recolte: '2026-10-20', superficie_recoltee_ha: '1', quantite: '1000',
      }),
      201,
    ).corps._id;
    attendu(await appel('POST', `/productions/${recolte}/validation`, jetonAdmin), 200);

    const achat = attendu(
      await appel('POST', '/achats', jetonTransfo, {
        activite: 'transformation', fournisseur_id: ref.fournisseur, date_achat: '2026-10-25', unite_transformation_id: ref.unite,
        lignes: [{ libelle: 'Paddy acheté', produit_id: ref.paddy, quantite: '500', prix_unitaire: '180' }],
      }),
      201,
    ).corps._id;
    attendu(await appel('POST', `/achats/${achat}/validation`, jetonTransfo), 200);
    assert.equal(attendu(await appel('POST', `/achats/${achat}/reception`, jetonTransfo), 200).corps.statut_reception, 'recu');
    assert.equal(await solde(ref.paddy), 1500);
  });

  it('valide une transformation : paddy diminué, riz et sous-produits augmentés', async () => {
    const creation = attendu(
      await creerOperation('1200', [
        { produit_id: ref.riz, quantite: '780' },
        { produit_id: ref.son, quantite: '200' },
        { produit_id: ref.brisures, quantite: '100.5' },
      ]),
      201,
    );
    assert.equal(creation.corps.statut, 'brouillon');
    assert.equal(creation.corps.resultats.length, 3);
    assert.equal(creation.corps.note_ecart, 'Pertes au décorticage');
    const id = creation.corps._id;

    const validation = attendu(await appel('POST', `/operations-transformation/${id}/validation`, jetonTransfo), 200);
    assert.equal(validation.corps.statut, 'validee');
    assert.ok(validation.corps.validated_at);
    assert.equal(await solde(ref.paddy), 300);
    assert.equal(await solde(ref.riz), 780);
    assert.equal(await solde(ref.son), 200);
    assert.equal(await solde(ref.brisures), 100.5);

    const sortiePaddy = await mouvementsOperation(id, ref.paddy);
    assert.equal(sortiePaddy.length, 1);
    assert.equal(sortiePaddy[0].sens, 'sortie');
    const entreeRiz = await mouvementsOperation(id, ref.riz);
    assert.equal(entreeRiz.length, 1);
    assert.equal(entreeRiz[0].sens, 'entree');
    assert.equal(entreeRiz[0].ligne_id, creation.corps.resultats[0].ligne_id);

    assert.equal(attendu(await appel('POST', `/operations-transformation/${id}/validation`, jetonTransfo), 200).corps.statut, 'validee');
    assert.equal((await mouvementsOperation(id, ref.paddy)).length, 1);
    attendu(await appel('PATCH', `/operations-transformation/${id}`, jetonTransfo, { quantite_paddy: '1' }), 409, 'operation_non_modifiable');
    const liste = attendu(await appel('GET', `/operations-transformation?unite_transformation_id=${ref.unite}&statut=validee`, jetonTransfo), 200);
    assert.ok(liste.corps.items.some((o: { _id: string }) => o._id === id));
    // Filtre de période sur date_operation (2026-11-05) : date_fin sans heure couvre toute la journée.
    const contient = async (requete: string) =>
      attendu(await appel('GET', `/operations-transformation?${requete}&taille_page=100`, jetonTransfo), 200).corps.items.some(
        (o: { _id: string }) => o._id === id,
      );
    assert.equal(await contient('date_debut=2026-11-05&date_fin=2026-11-05'), true);
    assert.equal(await contient('date_debut=2026-11-06'), false);
    assert.equal(await contient('date_fin=2026-11-04'), false);
    attendu(await appel('GET', '/operations-transformation?date_debut=pas-une-date', jetonTransfo), 422, 'donnees_invalides');
    ref.operationPrincipale = id;
  });

  it('refuse la validation si le paddy est insuffisant et ne change rien', async () => {
    const id = attendu(await creerOperation('1000', [{ produit_id: ref.riz, quantite: '650' }]), 201).corps._id;
    const refus = attendu(await appel('POST', `/operations-transformation/${id}/validation`, jetonTransfo), 409, 'stock_insuffisant');
    assert.equal(refus.corps.erreur.details.produit_id, ref.paddy);
    assert.equal(refus.corps.erreur.details.quantite_disponible, '300');
    assert.equal(attendu(await appel('GET', `/operations-transformation/${id}`, jetonTransfo), 200).corps.statut, 'brouillon');
    assert.equal(await solde(ref.paddy), 300);
    assert.equal(await solde(ref.riz), 780);
    assert.equal((await mouvementsOperation(id, ref.riz)).length, 0);
  });

  it('ne crée qu’un jeu de mouvements pour deux validations simultanées', async () => {
    const id = attendu(await creerOperation('100', [{ produit_id: ref.riz, quantite: '65' }]), 201).corps._id;
    const reponses = await Promise.all([
      appel('POST', `/operations-transformation/${id}/validation`, jetonTransfo),
      appel('POST', `/operations-transformation/${id}/validation`, jetonTransfo),
    ]);
    for (const reponse of reponses) assert.equal(attendu(reponse, 200).corps.statut, 'validee');
    assert.equal((await mouvementsOperation(id, ref.paddy)).length, 1);
    assert.equal((await mouvementsOperation(id, ref.riz)).length, 1);
    assert.equal(await solde(ref.paddy), 200);
    assert.equal(await solde(ref.riz), 845);
    ref.operationSimultanee = id;
  });
});

describe('Annulation et contrepassation', () => {
  it('annule un brouillon sans mouvement', async () => {
    const id = attendu(await creerOperation('10', [{ produit_id: ref.son, quantite: '2' }]), 201).corps._id;
    assert.equal(attendu(await appel('PATCH', `/operations-transformation/${id}`, jetonTransfo, { quantite_paddy: '12', note_ecart: null }), 200).corps.note_ecart, null);
    attendu(await appel('POST', `/operations-transformation/${id}/annulation`, jetonTransfo, {}), 422, 'donnees_invalides');
    assert.equal(attendu(await appel('POST', `/operations-transformation/${id}/annulation`, jetonTransfo, { motif: 'Saisie test' }), 200).corps.statut, 'annulee');
    attendu(await appel('POST', `/operations-transformation/${id}/validation`, jetonTransfo), 409, 'transition_invalide');
    assert.equal((await mouvementsOperation(id, ref.son)).length, 0);
  });

  it('contrepasse une transformation validée : le paddy revient, le riz ressort', async () => {
    const annulation = attendu(await appel('POST', `/operations-transformation/${ref.operationSimultanee}/annulation`, jetonTransfo, { motif: 'Lot mal pesé' }), 200);
    assert.equal(annulation.corps.statut, 'annulee');
    assert.equal(annulation.corps.motif_annulation, 'Lot mal pesé');
    assert.equal(await solde(ref.paddy), 300);
    assert.equal(await solde(ref.riz), 780);
    const mouvementsPaddy = await mouvementsOperation(ref.operationSimultanee, ref.paddy);
    assert.equal(mouvementsPaddy.length, 2);
    assert.ok(mouvementsPaddy.some((m: { sens: string; annule_mouvement_id: string | null }) => m.sens === 'entree' && m.annule_mouvement_id));
  });

  it('refuse l’annulation si les produits obtenus ont déjà été utilisés', async () => {
    // Sortie commerciale réelle : commande de 500 kg de riz livrée par l'API.
    const client = attendu(await appel('POST', '/clients', jetonAdmin, { nom: `${prefixe} Grossiste` }), 201).corps._id;
    const commande = attendu(
      await appel('POST', '/commandes-clients', jetonAdmin, {
        client_id: client, date_commande: '2026-11-06', lignes: [{ produit_id: ref.riz, quantite: '500', prix_unitaire: '400' }],
      }),
      201,
    ).corps._id;
    const livraison = attendu(await appel('POST', `/commandes-clients/${commande}/livraison`, jetonAdmin), 200);
    assert.equal(livraison.corps.vente.statut, 'validee');
    attendu(await appel('POST', `/operations-transformation/${ref.operationPrincipale}/annulation`, jetonTransfo, { motif: 'Erreur' }), 409, 'stock_insuffisant');
    assert.equal(attendu(await appel('GET', `/operations-transformation/${ref.operationPrincipale}`, jetonTransfo), 200).corps.statut, 'validee');
    assert.equal(await solde(ref.paddy), 300);
    assert.equal(await solde(ref.riz), 280);
  });
});

describe('Contrôles de saisie et périmètre', () => {
  it('contrôle les produits et quantités', async () => {
    attendu(await creerOperation('10', []), 422, 'donnees_invalides');
    attendu(await creerOperation('10', [{ produit_id: ref.paddy, quantite: '5' }]), 422, 'donnees_invalides');
    attendu(await creerOperation('10', [{ produit_id: ref.engrais, quantite: '5' }]), 422, 'produit_non_stockable');
    attendu(await creerOperation('0', [{ produit_id: ref.riz, quantite: '5' }]), 422, 'donnees_invalides');
    attendu(await creerOperation('10', [{ produit_id: ref.riz, quantite: '0' }]), 422, 'donnees_invalides');
    attendu(await appel('GET', '/operations-transformation/000000000000000000000000', jetonTransfo), 404, 'ressource_introuvable');
  });

  it('refuse les modules de transformation hors de l’activité ou sans permission', async () => {
    for (const chemin of ['/unites-transformation', '/operations-transformation']) {
      attendu(await appel('GET', chemin), 401, 'session_invalide');
      attendu(await appel('GET', chemin, jetonProduction), 403, 'acces_refuse');
      attendu(await appel('GET', chemin, jetonAgent), 403, 'acces_refuse');
    }
    attendu(await appel('GET', `/operations-transformation/${ref.operationPrincipale}`, jetonProduction), 403, 'acces_refuse');
    attendu(await creerOperation('1', [{ produit_id: ref.riz, quantite: '1' }], jetonProduction), 403, 'acces_refuse');
    attendu(await appel('POST', `/operations-transformation/${ref.operationPrincipale}/annulation`, jetonProduction, { motif: 'X' }), 403, 'acces_refuse');
    attendu(await appel('POST', '/unites-transformation', jetonProduction, { code: `${prefixe}-X`, nom: 'X' }), 403, 'acces_refuse');
  });
});
