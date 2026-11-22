/**
 * Tests d'intégration des modules Inventaires, Matériel, Types de dépenses et Dépenses sur la base Atlas
 * de tests : stock initial par inventaire, inventaire obsolète, validations simultanées, annulation,
 * droits par site et activité, annulation d'une dépense et justificatif (service Dépenses + Cloudinary).
 * Les données créées portent le préfixe « TST-<suffixe> » et sont supprimées à la fin.
 * Utilisation : npm run test:inventaires-depenses
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
import { depenseService } from '../src/modules/depenses/services/depenseService.js';
import { stockService } from '../src/modules/stock/services/stockService.js';

interface Reponse {
  statut: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  corps: any;
}

const suffixe = Date.now().toString(36).toUpperCase();
const prefixe = `TST-${suffixe}`;
const MOT_DE_PASSE = 'Inventaires-2026!';
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const PDF_MINIMAL = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

let serveur: Server;
let urlApi: string;
let jetonAdmin: string;
let jetonAgent: string;
let jetonSiteA: string;
let jetonTransfo: string;
const ref: Record<string, string> = {};
const mediasCrees: { public_id: string; type: 'image' | 'raw' }[] = [];

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

async function connecter(email: string, motDePasse: string): Promise<{ jeton: string }> {
  return { jeton: attendu(await appel('POST', '/auth/connexion', undefined, { email, mot_de_passe: motDePasse }), 200).corps.jeton };
}

async function solde(produitId: string): Promise<number> {
  const reponse = attendu(await appel('GET', `/stock?produit_id=${produitId}`, jetonAdmin), 200);
  return reponse.corps.items.length === 0 ? 0 : Number(reponse.corps.items[0].quantite_disponible);
}

async function mouvementsInventaire(inventaireId: string, produitId: string) {
  const reponse = attendu(await appel('GET', `/mouvements-stock?produit_id=${produitId}&origine_type=inventaire&taille_page=100`, jetonAdmin), 200);
  return reponse.corps.items.filter((m: { origine_id: string }) => m.origine_id === inventaireId);
}

async function creerInventaire(lignes: unknown[]): Promise<Reponse> {
  return appel('POST', '/inventaires', jetonAdmin, { date_inventaire: '2026-11-20', lignes });
}

/** Session de l'utilisateur limité au site A, pour appeler directement le service Dépenses. */
async function contexteSiteA() {
  return authentificationService.verifierSession(jetonSiteA);
}

before(async () => {
  await connecterMongo(configuration.mongodbBaseTests);
  const { administrateur, limite } = await initialiserComptesTests();
  serveur = creerApplication().listen(0);
  urlApi = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}/api/v1`;
  ({ jeton: jetonAdmin } = await connecter(administrateur.email, administrateur.mot_de_passe));
  ({ jeton: jetonAgent } = await connecter(limite.email, limite.mot_de_passe));

  const creer = async (chemin: string, corps: unknown) => attendu(await appel('POST', chemin, jetonAdmin, corps), 201).corps._id as string;
  ref.categorie = await creer('/categories-produits', { code: `${prefixe}-CAT`, nom: 'Intrants' });
  ref.npk = await creer('/produits', { code: `${prefixe}-NPK`, nom: 'NPK', categorie_id: ref.categorie, unite_stock: 'sac', activites: ['production'] });
  ref.uree = await creer('/produits', { code: `${prefixe}-UREE`, nom: 'Urée', categorie_id: ref.categorie, unite_stock: 'sac', activites: ['production'] });
  ref.siteA = await creer('/sites-production', { code: `${prefixe}-A`, nom: 'Site A' });
  ref.siteB = await creer('/sites-production', { code: `${prefixe}-B`, nom: 'Site B' });
  ref.siteHors = await creer('/sites-production', { code: `${prefixe}-H`, nom: 'Site hors campagne' });
  ref.campagne = await creer('/campagnes-agricoles', {
    code: `${prefixe}-HIV`, nom: 'Hivernage', date_debut: '2026-06-01', date_fin: '2026-12-31', site_ids: [ref.siteA, ref.siteB],
  });
  attendu(await appel('POST', `/campagnes-agricoles/${ref.campagne}/ouverture`, jetonAdmin), 200);
  ref.unite = await creer('/unites-transformation', { code: `${prefixe}-UT`, nom: 'Rizerie' });

  const permissions = ['depenses', 'materiels', 'types_depenses', 'inventaires'].flatMap((module) =>
    ['consultation', 'saisie', 'validation'].map((action) => ({ module, action })),
  );
  const role = await creer('/roles', { code: `test_${suffixe.toLowerCase()}_depenses`, nom: 'Dépenses test', permissions });
  const compte = async (nom: string, activites: string[], site_ids: string[] = []) => {
    const email = `test.${nom}.${suffixe.toLowerCase()}@riz-de-niono.test`;
    await creer('/utilisateurs', { nom: `Test ${nom}`, email, mot_de_passe: MOT_DE_PASSE, role_id: role, activites, site_ids });
    return (await connecter(email, MOT_DE_PASSE)).jeton;
  };
  jetonSiteA = await compte('depenses-site-a', ['production'], [ref.siteA]);
  jetonTransfo = await compte('depenses-transfo', ['transformation']);
});

after(async () => {
  serveur?.close();
  for (const media of mediasCrees) {
    await import('../src/modules/media/services/mediaService.js').then(({ mediaService }) => mediaService.supprimer(media.public_id, media.type).catch(() => false));
  }
  const base = mongoose.connection.db;
  if (!base) return;
  const motif = { $regex: `^${prefixe}` };
  const idsDe = async (collection: string, filtre: object) =>
    (await base.collection(collection).find(filtre, { projection: { _id: 1 } }).toArray()).map((d) => d._id);

  const produits = await idsDe('produits', { code: motif });
  const inventaires = await idsDe('inventaires', { 'lignes.produit_id': { $in: produits } });
  const depenses = await idsDe('depenses', { libelle: motif });
  const typesDepenses = await idsDe('types_depenses', { code: motif });
  const documents = [...inventaires, ...depenses, ...typesDepenses, ...(await idsDe('mouvements_stock', { produit_id: { $in: produits } }))];
  await base.collection('inventaires').deleteMany({ _id: { $in: inventaires } });
  await base.collection('depenses').deleteMany({ _id: { $in: depenses } });
  await base.collection('mouvements_stock').deleteMany({ produit_id: { $in: produits } });
  await base.collection('stocks').deleteMany({ produit_id: { $in: produits } });
  for (const collection of ['categories_produits', 'produits', 'sites_production', 'campagnes_agricoles', 'unites_transformation', 'materiels', 'types_depenses']) {
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

describe('Inventaires', () => {
  it('saisit le stock initial d’un produit sans stock', async () => {
    attendu(await creerInventaire([{ produit_id: ref.npk, quantite_comptee: '120' }]), 422, 'donnees_invalides');
    const creation = attendu(await creerInventaire([{ produit_id: ref.npk, quantite_comptee: '120', motif_ecart: 'Stock initial' }]), 201);
    const ligne = creation.corps.lignes[0];
    assert.equal(ligne.quantite_theorique, '0');
    assert.equal(ligne.version_stock, 0);
    assert.equal(ligne.ecart, '120');
    const validation = attendu(await appel('POST', `/inventaires/${creation.corps._id}/validation`, jetonAdmin), 200);
    assert.equal(validation.corps.statut, 'validee');
    assert.equal(await solde(ref.npk), 120);
    const mouvements = await mouvementsInventaire(creation.corps._id, ref.npk);
    assert.equal(mouvements.length, 1);
    assert.equal(mouvements[0].sens, 'entree');
    assert.equal(mouvements[0].quantite, '120');
    ref.inventaireInitial = creation.corps._id;
  });

  it('refuse un inventaire devenu obsolète, le garde en brouillon puis l’accepte après un nouveau relevé', async () => {
    const creation = attendu(await creerInventaire([{ produit_id: ref.npk, quantite_comptee: '115', motif_ecart: 'Sacs déchirés' }]), 201);
    const id = creation.corps._id;
    assert.equal(creation.corps.lignes[0].quantite_theorique, '120');

    // Données de test : un mouvement survient après le comptage.
    await stockService.enregistrerEcritureManuelle(authentificationService.contexteSysteme(), {
      produit_id: ref.npk, sens: 'entree', quantite: '5', motif: 'Mouvement après comptage',
    });
    const refus = attendu(await appel('POST', `/inventaires/${id}/validation`, jetonAdmin), 409, 'stock_modifie');
    assert.equal(refus.corps.erreur.details.produits[0].quantite_disponible_actuelle, '125');
    assert.equal(attendu(await appel('GET', `/inventaires/${id}`, jetonAdmin), 200).corps.statut, 'brouillon');
    assert.equal(await solde(ref.npk), 125);
    assert.equal((await mouvementsInventaire(id, ref.npk)).length, 0);

    // Nouveau relevé par modification des lignes : seul l'écart (−10) est appliqué.
    const releve = attendu(await appel('PATCH', `/inventaires/${id}`, jetonAdmin, { lignes: [{ produit_id: ref.npk, quantite_comptee: '115', motif_ecart: 'Sacs déchirés' }] }), 200);
    assert.equal(releve.corps.lignes[0].quantite_theorique, '125');
    assert.equal(releve.corps.lignes[0].ecart, '-10');
    attendu(await appel('POST', `/inventaires/${id}/validation`, jetonAdmin), 200);
    assert.equal(await solde(ref.npk), 115);
    const mouvements = await mouvementsInventaire(id, ref.npk);
    assert.equal(mouvements.length, 1);
    assert.equal(mouvements[0].sens, 'sortie');
    assert.equal(mouvements[0].quantite, '10');
    ref.inventaireEcart = id;
  });

  it('n’applique qu’un ajustement pour deux validations simultanées', async () => {
    const id = attendu(
      await creerInventaire([
        { produit_id: ref.npk, quantite_comptee: '100', motif_ecart: 'Écart de comptage' },
        { produit_id: ref.uree, quantite_comptee: '0' },
      ]),
      201,
    ).corps._id;
    const reponses = await Promise.all([appel('POST', `/inventaires/${id}/validation`, jetonAdmin), appel('POST', `/inventaires/${id}/validation`, jetonAdmin)]);
    for (const reponse of reponses) assert.equal(attendu(reponse, 200).corps.statut, 'validee');
    assert.equal((await mouvementsInventaire(id, ref.npk)).length, 1);
    assert.equal((await mouvementsInventaire(id, ref.uree)).length, 0);
    assert.equal(await solde(ref.npk), 100);
    ref.inventaireSimultane = id;
  });

  it('applique les règles de saisie et d’annulation', async () => {
    attendu(await creerInventaire([]), 422, 'donnees_invalides');
    attendu(
      await creerInventaire([
        { produit_id: ref.npk, quantite_comptee: '100' },
        { produit_id: ref.npk, quantite_comptee: '100' },
      ]),
      422,
      'donnees_invalides',
    );
    attendu(await appel('PATCH', `/inventaires/${ref.inventaireSimultane}`, jetonAdmin, { date_inventaire: '2026-11-21' }), 409, 'operation_non_modifiable');

    const brouillon = attendu(await creerInventaire([{ produit_id: ref.uree, quantite_comptee: '3', motif_ecart: 'Trouvés' }]), 201).corps._id;
    assert.equal(attendu(await appel('POST', `/inventaires/${brouillon}/annulation`, jetonAdmin, { motif: 'Comptage repris' }), 200).corps.statut, 'annulee');
    attendu(await appel('POST', `/inventaires/${brouillon}/validation`, jetonAdmin), 409, 'transition_invalide');

    // Annuler un inventaire validé contrepasse son ajustement (−15 annulé : le solde revient à 115).
    const annulation = attendu(await appel('POST', `/inventaires/${ref.inventaireSimultane}/annulation`, jetonAdmin, { motif: 'Erreur de saisie' }), 200);
    assert.equal(annulation.corps.statut, 'annulee');
    assert.equal(await solde(ref.npk), 115);
    const liste = attendu(await appel('GET', '/inventaires?statut=annulee&taille_page=100', jetonAdmin), 200);
    assert.ok(liste.corps.items.some((i: { _id: string }) => i._id === ref.inventaireSimultane));
    attendu(await appel('GET', '/inventaires', jetonAgent), 403, 'acces_refuse');
  });
});

describe('Types de dépenses et matériel', () => {
  it('garantit le type « Entretien du matériel » et gère le référentiel', async () => {
    const types = attendu(await appel('GET', '/types-depenses?actif=true&taille_page=100', jetonAdmin), 200).corps.items;
    const entretien = types.find((t: { code: string }) => t.code === 'ENTRETIEN-MATERIEL');
    assert.equal(entretien.nom, 'Entretien du matériel');
    ref.typeEntretien = entretien._id;
    attendu(await appel('PATCH', `/types-depenses/${entretien._id}`, jetonAdmin, { actif: false }), 409, 'type_reference');
    attendu(await appel('PATCH', `/types-depenses/${entretien._id}`, jetonAdmin, { code: 'AUTRE' }), 409, 'type_reference');

    ref.typeCarburant = attendu(await appel('POST', '/types-depenses', jetonAdmin, { code: `${prefixe}-CARB`, nom: 'Carburant' }), 201).corps._id;
    attendu(await appel('POST', '/types-depenses', jetonAdmin, { code: `${prefixe}-CARB`, nom: 'Doublon' }), 409, 'code_deja_utilise');
    const archive = attendu(await appel('POST', '/types-depenses', jetonAdmin, { code: `${prefixe}-OLD`, nom: 'Ancien' }), 201).corps._id;
    assert.equal(attendu(await appel('PATCH', `/types-depenses/${archive}`, jetonAdmin, { actif: false }), 200).corps.actif, false);
    ref.typeArchive = archive;
  });

  it('gère les fiches de matériel et leurs quantités', async () => {
    attendu(
      await appel('POST', '/materiels', jetonAdmin, { code: `${prefixe}-X`, nom: 'X', activites: ['production'], quantite_totale: '1', quantite_disponible: '2' }),
      422,
      'donnees_invalides',
    );
    const tracteur = attendu(
      await appel('POST', '/materiels', jetonSiteA, { code: `${prefixe}-TRACT`, nom: 'Tracteur', activites: ['production'], quantite_totale: '2', quantite_disponible: '1' }),
      201,
    );
    ref.tracteur = tracteur.corps._id;
    assert.equal(tracteur.corps.quantite_disponible, '1');
    assert.equal(attendu(await appel('PATCH', `/materiels/${ref.tracteur}`, jetonSiteA, { quantite_disponible: '2' }), 200).corps.quantite_disponible, '2');
    attendu(await appel('PATCH', `/materiels/${ref.tracteur}`, jetonSiteA, { quantite_totale: '1' }), 422, 'donnees_invalides');
    attendu(await appel('PATCH', `/materiels/${ref.tracteur}`, jetonSiteA, { activites: ['production', 'transformation'] }), 403, 'acces_refuse');
    assert.ok(attendu(await appel('GET', '/materiels?activite=production&taille_page=100', jetonSiteA), 200).corps.items.some((m: { _id: string }) => m._id === ref.tracteur));
    attendu(await appel('GET', `/materiels/${ref.tracteur}`, jetonTransfo), 404, 'ressource_introuvable');
    attendu(await appel('GET', '/materiels?activite=production', jetonTransfo), 403, 'acces_refuse');
    ref.decortiqueuse = attendu(
      await appel('POST', '/materiels', jetonTransfo, { code: `${prefixe}-DEC`, nom: 'Décortiqueuse', activites: ['transformation'], quantite_totale: '1', quantite_disponible: '1' }),
      201,
    ).corps._id;
  });
});

describe('Dépenses', () => {
  const depenseProduction = (corps: Record<string, unknown> = {}) => ({
    activite: 'production', type_depense_id: ref.typeCarburant, date_depense: '2026-07-10', montant: '25000',
    libelle: `${prefixe} Gasoil pompe`, site_id: ref.siteA, campagne_id: ref.campagne, ...corps,
  });

  it('contrôle le rattachement site–campagne en production et les références', async () => {
    attendu(await appel('POST', '/depenses', jetonSiteA, depenseProduction({ site_id: undefined })), 422, 'donnees_invalides');
    attendu(await appel('POST', '/depenses', jetonSiteA, depenseProduction({ campagne_id: undefined })), 422, 'donnees_invalides');
    attendu(await appel('POST', '/depenses', jetonAdmin, depenseProduction({ site_id: ref.siteHors })), 422, 'site_hors_campagne');
    attendu(await appel('POST', '/depenses', jetonSiteA, depenseProduction({ type_depense_id: ref.typeArchive })), 422, 'donnees_invalides');
    attendu(await appel('POST', '/depenses', jetonSiteA, depenseProduction({ materiel_id: ref.decortiqueuse })), 422, 'donnees_invalides');
    attendu(await appel('POST', '/depenses', jetonSiteA, depenseProduction({ montant: '0' })), 422, 'donnees_invalides');

    const entretien = attendu(
      await appel('POST', '/depenses', jetonSiteA, depenseProduction({ type_depense_id: ref.typeEntretien, materiel_id: ref.tracteur, libelle: `${prefixe} Vidange tracteur` })),
      201,
    );
    assert.equal(entretien.corps.materiel_id, ref.tracteur);
    assert.equal(entretien.corps.justificatif, null);
    ref.depenseA = entretien.corps._id;
  });

  it('applique les droits par site et par activité', async () => {
    const depenseB = attendu(await appel('POST', '/depenses', jetonAdmin, depenseProduction({ site_id: ref.siteB, libelle: `${prefixe} Main-d’œuvre B` })), 201).corps._id;
    attendu(await appel('POST', '/depenses', jetonSiteA, depenseProduction({ site_id: ref.siteB })), 403, 'acces_refuse');
    attendu(await appel('GET', `/depenses/${depenseB}`, jetonSiteA), 404, 'ressource_introuvable');
    attendu(await appel('POST', `/depenses/${depenseB}/validation`, jetonSiteA), 404, 'ressource_introuvable');
    attendu(await appel('GET', `/depenses?site_id=${ref.siteB}`, jetonSiteA), 403, 'acces_refuse');
    const liste = attendu(await appel('GET', `/depenses?campagne_id=${ref.campagne}&taille_page=100`, jetonSiteA), 200).corps.items;
    assert.ok(liste.length > 0 && liste.every((d: { site_id: string }) => d.site_id === ref.siteA));

    // Transformation : pas de site ni de campagne, unité facultative, aucune dépense de production visible.
    attendu(await appel('POST', '/depenses', jetonTransfo, depenseProduction()), 403, 'acces_refuse');
    attendu(
      await appel('POST', '/depenses', jetonTransfo, { ...depenseProduction(), activite: 'transformation', libelle: `${prefixe} Énergie` }),
      422,
      'donnees_invalides',
    );
    const transfo = attendu(
      await appel('POST', '/depenses', jetonTransfo, {
        activite: 'transformation', type_depense_id: ref.typeEntretien, date_depense: '2026-11-02', montant: '18000',
        libelle: `${prefixe} Courroie décortiqueuse`, unite_transformation_id: ref.unite, materiel_id: ref.decortiqueuse,
      }),
      201,
    );
    assert.equal(transfo.corps.unite_transformation_id, ref.unite);
    attendu(await appel('GET', `/depenses/${ref.depenseA}`, jetonTransfo), 404, 'ressource_introuvable');
    attendu(await appel('GET', '/depenses?activite=production', jetonTransfo), 403, 'acces_refuse');
    attendu(await appel('GET', '/depenses', jetonAgent), 403, 'acces_refuse');
  });

  it('valide puis annule une dépense avec motif', async () => {
    assert.equal(attendu(await appel('PATCH', `/depenses/${ref.depenseA}`, jetonSiteA, { montant: '27500' }), 200).corps.montant, '27500');
    assert.equal(attendu(await appel('POST', `/depenses/${ref.depenseA}/validation`, jetonSiteA), 200).corps.statut, 'validee');
    attendu(await appel('PATCH', `/depenses/${ref.depenseA}`, jetonSiteA, { montant: '1' }), 409, 'operation_non_modifiable');
    attendu(await appel('POST', `/depenses/${ref.depenseA}/annulation`, jetonSiteA, {}), 422, 'donnees_invalides');

    const brouillon = attendu(await appel('POST', '/depenses', jetonSiteA, depenseProduction({ libelle: `${prefixe} Brouillon` })), 201).corps._id;
    assert.equal(attendu(await appel('POST', `/depenses/${brouillon}/annulation`, jetonSiteA, { motif: 'Doublon' }), 200).corps.statut, 'annulee');
    attendu(await appel('POST', `/depenses/${brouillon}/validation`, jetonSiteA), 409, 'transition_invalide');
  });

  it('joint, remplace et retire un justificatif selon les droits sur la dépense', async () => {
    const contexte = await contexteSiteA();
    const avecImage = await depenseService.joindreJustificatif(contexte, ref.depenseA, { contenu: PNG_1X1, type_mime: 'image/png', nom_original: 'facture.png' });
    assert.ok(avecImage.justificatif);
    assert.match(avecImage.justificatif.url_securisee, /^https:\/\/res\.cloudinary\.com\//);
    assert.equal(avecImage.justificatif.nom_fichier, 'facture.png');
    assert.equal((await fetch(avecImage.justificatif.url_securisee)).status, 200);
    const premier = (await mongoose.connection.db!.collection('depenses').findOne({ _id: new mongoose.Types.ObjectId(ref.depenseA) }))!.justificatif;
    mediasCrees.push({ public_id: premier.public_id, type: premier.type_ressource });

    // Remplacement : le nouveau PDF est rattaché, l'ancien fichier est supprimé chez Cloudinary.
    const avecPdf = await depenseService.joindreJustificatif(contexte, ref.depenseA, { contenu: PDF_MINIMAL, type_mime: 'application/pdf', nom_original: 'recu.pdf' });
    assert.equal(avecPdf.justificatif?.type_ressource, 'raw');
    const second = (await mongoose.connection.db!.collection('depenses').findOne({ _id: new mongoose.Types.ObjectId(ref.depenseA) }))!.justificatif;
    mediasCrees.push({ public_id: second.public_id, type: second.type_ressource });
    const { mediaService } = await import('../src/modules/media/services/mediaService.js');
    assert.equal(await mediaService.supprimer(premier.public_id, premier.type_ressource), false);
    assert.equal(attendu(await appel('GET', `/depenses/${ref.depenseA}`, jetonSiteA), 200).corps.justificatif.nom_fichier, 'recu.pdf');

    // Droits : un utilisateur qui ne voit pas la dépense ne peut pas y joindre de fichier.
    const contexteTransfo = await authentificationService.verifierSession(jetonTransfo);
    await assert.rejects(
      depenseService.joindreJustificatif(contexteTransfo, ref.depenseA, { contenu: PNG_1X1, type_mime: 'image/png' }),
      { statut: 404, code: 'ressource_introuvable' },
    );
    await assert.rejects(
      depenseService.joindreJustificatif(contexte, ref.depenseA, { contenu: Buffer.from('x'), type_mime: 'text/plain' }),
      { statut: 422, code: 'type_fichier_refuse' },
    );

    const sansJustificatif = await depenseService.retirerJustificatif(contexte, ref.depenseA);
    assert.equal(sansJustificatif.justificatif, null);
    assert.equal(await mediaService.supprimer(second.public_id, second.type_ressource), false);
  });

  it('annule une dépense validée et refuse les écritures sur une campagne clôturée', async () => {
    const annulation = attendu(await appel('POST', `/depenses/${ref.depenseA}/annulation`, jetonSiteA, { motif: 'Facture en double' }), 200);
    assert.equal(annulation.corps.statut, 'annulee');
    assert.equal(annulation.corps.motif_annulation, 'Facture en double');
    await assert.rejects(
      depenseService.joindreJustificatif(await contexteSiteA(), ref.depenseA, { contenu: PNG_1X1, type_mime: 'image/png' }),
      { statut: 409, code: 'depense_annulee' },
    );

    attendu(await appel('POST', `/campagnes-agricoles/${ref.campagne}/cloture`, jetonAdmin), 200);
    attendu(await appel('POST', '/depenses', jetonAdmin, depenseProduction({ libelle: `${prefixe} Trop tard` })), 409, 'campagne_cloturee');
    assert.equal(attendu(await appel('GET', `/depenses/${ref.depenseA}`, jetonSiteA), 200).corps.statut, 'annulee');
  });
});
