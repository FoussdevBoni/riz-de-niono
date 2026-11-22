import { Types, type ClientSession } from 'mongoose';

import { decimal, depuisDecimal, versDecimal, versObjectIds } from '../../../database/decimalMongo.js';
import { STATUTS_OPERATION, type StatutOperation } from '../../../database/operationValidableSchema.js';
import { executerTransaction } from '../../../database/transactionMongo.js';
import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../http/pagination/paginationUtils.js';
import {
  authentificationService,
  type ContexteSession,
} from '../../authentification/services/authentificationService.js';
import { fournisseurService } from '../../fournisseurs/services/fournisseurService.js';
import { journalOperationService } from '../../journal-operations/services/journalOperationService.js';
import { campagneAgricoleService } from '../../production/campagnes-agricoles/services/campagneAgricoleService.js';
import { siteProductionService } from '../../production/sites-production/services/siteProductionService.js';
import { produitService } from '../../produits/services/produitService.js';
import { stockService } from '../../stock/services/stockService.js';
import { uniteTransformationService } from '../../transformation/unites-transformation/services/uniteTransformationService.js';
import type { Activite } from '../../utilisateurs/services/utilisateurService.js';
import { AchatModel, type DocumentAchat } from '../models/achatModel.js';
import { STATUTS_RECEPTION, type StatutReception } from '../schemas/achatSchema.js';

export { STATUTS_OPERATION, STATUTS_RECEPTION, type StatutOperation, type StatutReception };

export interface LigneAchatSaisie {
  libelle: string;
  produit_id: string | null;
  quantite: string;
  prix_unitaire: string;
}

export interface AchatPublic {
  _id: string;
  activite: Activite;
  fournisseur_id: string;
  date_achat: Date;
  site_id: string | null;
  campagne_id: string | null;
  unite_transformation_id: string | null;
  lignes: { ligne_id: string; libelle: string; produit_id: string | null; quantite: string; prix_unitaire: string; montant: string }[];
  montant_total: string;
  /** Somme des règlements validés. */
  montant_regle: string;
  solde_restant: string;
  statut: StatutOperation;
  statut_reception: StatutReception | null;
  recu_at: Date | null;
  recu_par_id: string | null;
  validated_at: Date | null;
  validated_by_id: string | null;
  motif_annulation: string | null;
  annulee_at: Date | null;
  annulee_par_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesAchat {
  activite?: Activite;
  fournisseur_id?: string;
  date_achat?: Date;
  site_id?: string | null;
  campagne_id?: string | null;
  unite_transformation_id?: string | null;
  lignes?: LigneAchatSaisie[];
}

const versChaine = (id: unknown) => (id ? String(id) : null);

function formater(achat: DocumentAchat): AchatPublic {
  const montantTotal = depuisDecimal(achat.montant_total)!;
  const montantRegle = depuisDecimal(achat.montant_regle) ?? '0';
  return {
    _id: String(achat._id),
    activite: achat.activite,
    fournisseur_id: String(achat.fournisseur_id),
    date_achat: achat.date_achat,
    site_id: versChaine(achat.site_id),
    campagne_id: versChaine(achat.campagne_id),
    unite_transformation_id: versChaine(achat.unite_transformation_id),
    lignes: achat.lignes.map((ligne) => {
      const quantite = depuisDecimal(ligne.quantite)!;
      const prixUnitaire = depuisDecimal(ligne.prix_unitaire)!;
      return {
        ligne_id: String(ligne.ligne_id),
        libelle: ligne.libelle,
        produit_id: versChaine(ligne.produit_id),
        quantite,
        prix_unitaire: prixUnitaire,
        montant: decimal.multiplier(quantite, prixUnitaire),
      };
    }),
    montant_total: decimal.normaliser(montantTotal),
    montant_regle: decimal.normaliser(montantRegle),
    solde_restant: decimal.soustraire(montantTotal, montantRegle),
    statut: achat.statut,
    statut_reception: achat.statut_reception ?? null,
    recu_at: achat.recu_at ?? null,
    recu_par_id: versChaine(achat.recu_par_id),
    validated_at: achat.validated_at ?? null,
    validated_by_id: versChaine(achat.validated_by_id),
    motif_annulation: achat.motif_annulation ?? null,
    annulee_at: achat.annulee_at ?? null,
    annulee_par_id: versChaine(achat.annulee_par_id),
    created_at: achat.created_at,
    updated_at: achat.updated_at,
  };
}

function montantTotal(lignes: readonly LigneAchatSaisie[]): string {
  return decimal.additionner(...lignes.map((ligne) => decimal.multiplier(ligne.quantite, ligne.prix_unitaire)));
}

function versLignes(lignes: readonly LigneAchatSaisie[]) {
  return lignes.map((ligne) => ({
    ligne_id: new Types.ObjectId(),
    libelle: ligne.libelle,
    produit_id: ligne.produit_id,
    quantite: versDecimal(ligne.quantite),
    prix_unitaire: versDecimal(ligne.prix_unitaire),
  }));
}

/** Achat visible : activité dans le périmètre, et site couvert s'il est affecté à un site. */
function estVisible(contexte: ContexteSession, achat: Pick<DocumentAchat, 'activite' | 'site_id'>): boolean {
  return (
    contexte.activites.includes(achat.activite) &&
    (!achat.site_id || authentificationService.couvreSites(contexte, [String(achat.site_id)]))
  );
}

async function trouverVisible(contexte: ContexteSession, id: string): Promise<DocumentAchat> {
  const achat = await AchatModel.findById(id).lean<DocumentAchat>();
  if (!achat || !estVisible(contexte, achat)) throw erreurs.ressourceIntrouvable('Achat introuvable.');
  return achat;
}

/** Traduction d'estVisible en filtre de liste ; une activité demandée hors périmètre renvoie 403. */
function filtreVisibilite(contexte: ContexteSession, activite?: Activite): Record<string, unknown> {
  if (activite && !contexte.activites.includes(activite)) {
    throw erreurs.accesRefuse(`Votre périmètre n'inclut pas l'activité ${activite}.`);
  }
  const filtre: Record<string, unknown> = { activite: activite ?? { $in: contexte.activites } };
  if (authentificationService.estLimiteAuxSites(contexte)) {
    filtre.$or = [{ site_id: null }, { site_id: { $in: versObjectIds(contexte.site_ids) } }];
  }
  return filtre;
}

/**
 * Contrôles d'une saisie complète (création ou état résultant d'une modification) :
 * activité du périmètre, fournisseur actif, rattachements propres à l'activité, produits achetables.
 * nouvelleUnite : l'unité de transformation n'est contrôlée (existante et active) que pour une nouvelle
 * affectation, afin qu'un achat déjà lié à une unité archivée reste modifiable et validable.
 */
async function verifierSaisie(
  contexte: ContexteSession,
  achat: Required<DonneesAchat>,
  { nouvelleUnite = true }: { nouvelleUnite?: boolean } = {},
): Promise<void> {
  if (!contexte.activites.includes(achat.activite)) {
    throw erreurs.accesRefuse(`Votre périmètre n'inclut pas l'activité ${achat.activite}.`);
  }
  if (achat.lignes.length === 0) {
    throw erreurs.donneesInvalides('Un achat contient au moins une ligne.', { champ: 'lignes' });
  }
  if (achat.activite !== 'production' && (achat.site_id || achat.campagne_id)) {
    throw erreurs.donneesInvalides('Le site et la campagne ne s’appliquent qu’aux achats de production.', {
      champ: achat.site_id ? 'site_id' : 'campagne_id',
    });
  }
  if (achat.activite !== 'transformation' && achat.unite_transformation_id) {
    throw erreurs.donneesInvalides('L’unité de transformation ne s’applique qu’aux achats de transformation.', {
      champ: 'unite_transformation_id',
    });
  }
  await fournisseurService.verifierFournisseurAttribuable(achat.fournisseur_id);
  if (achat.site_id) {
    authentificationService.exigerSite(contexte, achat.site_id);
    await siteProductionService.verifierSitesAttribuables([achat.site_id], 'site_id');
  }
  if (achat.campagne_id) {
    if (achat.site_id) await campagneAgricoleService.verifierRattachement(achat.campagne_id, achat.site_id);
    else await campagneAgricoleService.verifierCampagneUtilisable(achat.campagne_id);
  }
  if (achat.unite_transformation_id && nouvelleUnite) {
    await uniteTransformationService.verifierUniteAttribuable(achat.unite_transformation_id);
  }
  for (const [index, ligne] of achat.lignes.entries()) {
    if (ligne.produit_id) {
      await produitService.verifierProduitAchetable(ligne.produit_id, achat.activite, `lignes[${index}].produit_id`);
    }
  }
}

function lignesSaisies(achat: DocumentAchat): LigneAchatSaisie[] {
  return achat.lignes.map((ligne) => ({
    libelle: ligne.libelle,
    produit_id: versChaine(ligne.produit_id),
    quantite: depuisDecimal(ligne.quantite)!,
    prix_unitaire: depuisDecimal(ligne.prix_unitaire)!,
  }));
}

function erreurAchatNonValide(statut: StatutOperation) {
  return erreurs.conflit('achat_non_valide', `L’achat doit être validé (statut actuel : ${statut}).`, { statut });
}

/**
 * Service du module achats, partagé par les trois activités.
 * Statut de l'achat : brouillon → validee → annulee. Statut de réception (achats d'articles
 * stockables) : en_cours dès la validation, puis recu ; le passage à recu fait entrer les lignes
 * stockables en stock dans la même transaction. Le montant réglé est tenu à partir des règlements validés.
 */
export const achatService = {
  async lister(
    contexte: ContexteSession,
    filtres: { activite?: Activite; fournisseur_id?: string; statut?: StatutOperation; statut_reception?: StatutReception },
    pagination: ParametresPagination,
  ): Promise<PageResultats<AchatPublic>> {
    const filtre = filtreVisibilite(contexte, filtres.activite);
    if (filtres.fournisseur_id) filtre.fournisseur_id = filtres.fournisseur_id;
    if (filtres.statut) filtre.statut = filtres.statut;
    if (filtres.statut_reception) filtre.statut_reception = filtres.statut_reception;
    const [achats, total] = await Promise.all([
      AchatModel.find(filtre).sort({ date_achat: -1, _id: -1 }).skip(pagination.saut).limit(pagination.taille_page).lean<DocumentAchat[]>(),
      AchatModel.countDocuments(filtre),
    ]);
    return construirePage(achats.map(formater), total, pagination);
  },

  async consulter(contexte: ContexteSession, id: string): Promise<AchatPublic> {
    return formater(await trouverVisible(contexte, id));
  },

  async creer(
    contexte: ContexteSession,
    donnees: Required<Pick<DonneesAchat, 'activite' | 'fournisseur_id' | 'date_achat' | 'lignes'>> & DonneesAchat,
  ): Promise<AchatPublic> {
    const achat: Required<DonneesAchat> = {
      activite: donnees.activite,
      fournisseur_id: donnees.fournisseur_id,
      date_achat: donnees.date_achat,
      site_id: donnees.site_id ?? null,
      campagne_id: donnees.campagne_id ?? null,
      unite_transformation_id: donnees.unite_transformation_id ?? null,
      lignes: donnees.lignes,
    };
    await verifierSaisie(contexte, achat);
    const id = await executerTransaction(async (session) => {
      const [cree] = await AchatModel.create(
        [
          {
            ...achat,
            lignes: versLignes(achat.lignes),
            montant_total: versDecimal(montantTotal(achat.lignes)),
            montant_regle: versDecimal('0'),
            statut: 'brouillon',
          },
        ],
        { session },
      );
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'creation', collection: 'achats', document_id: String(cree._id) },
        session,
      );
      return String(cree._id);
    });
    return achatService.consulter(contexte, id);
  },

  /** Seul un brouillon se modifie. Les lignes transmises remplacent toutes les lignes. */
  async modifier(contexte: ContexteSession, id: string, donnees: DonneesAchat): Promise<AchatPublic> {
    const achat = await trouverVisible(contexte, id);
    if (achat.statut !== 'brouillon') {
      throw erreurs.conflit('operation_non_modifiable', `Un achat au statut ${achat.statut} ne peut plus être modifié.`, {
        statut: achat.statut,
      });
    }
    const resultat: Required<DonneesAchat> = {
      activite: donnees.activite ?? achat.activite,
      fournisseur_id: donnees.fournisseur_id ?? String(achat.fournisseur_id),
      date_achat: donnees.date_achat ?? achat.date_achat,
      site_id: donnees.site_id !== undefined ? donnees.site_id : versChaine(achat.site_id),
      campagne_id: donnees.campagne_id !== undefined ? donnees.campagne_id : versChaine(achat.campagne_id),
      unite_transformation_id:
        donnees.unite_transformation_id !== undefined ? donnees.unite_transformation_id : versChaine(achat.unite_transformation_id),
      lignes: donnees.lignes ?? lignesSaisies(achat),
    };
    await verifierSaisie(contexte, resultat, {
      nouvelleUnite: resultat.unite_transformation_id !== versChaine(achat.unite_transformation_id),
    });

    const modifications: Record<string, unknown> = {};
    for (const champ of ['activite', 'fournisseur_id', 'date_achat', 'site_id', 'campagne_id', 'unite_transformation_id'] as const) {
      if (donnees[champ] !== undefined) modifications[champ] = donnees[champ];
    }
    if (donnees.lignes !== undefined) {
      modifications.lignes = versLignes(donnees.lignes);
      modifications.montant_total = versDecimal(montantTotal(donnees.lignes));
    }
    if (Object.keys(modifications).length === 0) return formater(achat);

    await executerTransaction(async (session) => {
      const maj = await AchatModel.updateOne({ _id: id, statut: 'brouillon' }, { $set: modifications }, { session });
      if (maj.matchedCount === 0) throw erreurs.conflit('statut_modifie', 'Le statut de l’achat a changé : relire la fiche.');
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'modification', collection: 'achats', document_id: id },
        session,
      );
    });
    return achatService.consulter(contexte, id);
  },

  /** brouillon → validee. Un achat d'articles stockables commence avec statut_reception = en_cours. */
  async valider(contexte: ContexteSession, id: string): Promise<AchatPublic> {
    const achat = await trouverVisible(contexte, id);
    if (achat.statut === 'validee') return formater(achat);
    if (achat.statut === 'annulee') {
      throw erreurs.conflit('transition_invalide', 'Un achat annulé ne peut pas être validé.', { statut: achat.statut });
    }
    const lignes = lignesSaisies(achat);
    await verifierSaisie(contexte, {
      activite: achat.activite,
      fournisseur_id: String(achat.fournisseur_id),
      date_achat: achat.date_achat,
      site_id: versChaine(achat.site_id),
      campagne_id: versChaine(achat.campagne_id),
      unite_transformation_id: versChaine(achat.unite_transformation_id),
      lignes,
    }, { nouvelleUnite: false });
    const stockables = await produitService.lireStockables(lignes.flatMap((ligne) => (ligne.produit_id ? [ligne.produit_id] : [])));

    await executerTransaction(async (session) => {
      const reservation = await AchatModel.updateOne(
        { _id: id, statut: 'brouillon' },
        {
          $set: {
            statut: 'validee',
            statut_reception: stockables.size > 0 ? 'en_cours' : null,
            validated_at: new Date(),
            validated_by_id: contexte.utilisateur_id,
          },
        },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'validation', collection: 'achats', document_id: id },
        session,
      );
    });
    return terminerTransition(contexte, id, (a) => a.statut === 'validee');
  },

  /**
   * Réception depuis la fiche d'achat : en_cours → recu, et une entrée en stock par ligne stockable,
   * dans la même transaction. Une réception répétée ou simultanée ne crée qu'une entrée par ligne.
   */
  async receptionner(contexte: ContexteSession, id: string): Promise<AchatPublic> {
    const achat = await trouverVisible(contexte, id);
    if (achat.statut !== 'validee') throw erreurAchatNonValide(achat.statut);
    if (achat.statut_reception === 'recu') return formater(achat);
    if (achat.statut_reception !== 'en_cours') {
      throw erreurs.conflit('reception_sans_objet', 'Cet achat ne comporte aucun article stockable à réceptionner.');
    }
    const lignes = achat.lignes.filter((ligne) => ligne.produit_id);
    const stockables = await produitService.lireStockables(lignes.map((ligne) => String(ligne.produit_id)));

    await executerTransaction(async (session) => {
      const reservation = await AchatModel.updateOne(
        { _id: id, statut: 'validee', statut_reception: 'en_cours' },
        { $set: { statut_reception: 'recu', recu_at: new Date(), recu_par_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) return;
      await stockService.enregistrerMouvements(
        { type: 'achat', id },
        lignes
          .filter((ligne) => stockables.has(String(ligne.produit_id)))
          .map((ligne) => ({
            produit_id: String(ligne.produit_id),
            sens: 'entree' as const,
            quantite: depuisDecimal(ligne.quantite)!,
            ligne_id: String(ligne.ligne_id),
          })),
        contexte,
        session,
      );
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'reception', collection: 'achats', document_id: id },
        session,
      );
    });
    return terminerTransition(contexte, id, (a) => a.statut_reception === 'recu');
  },

  /**
   * Annule un brouillon ou un achat validé. Un achat réglé exige d'abord l'annulation de ses règlements
   * (409 achat_regle). Un achat reçu est contrepassé par des sorties inverses si le stock le permet.
   */
  async annuler(contexte: ContexteSession, id: string, motif: string): Promise<AchatPublic> {
    const achat = await trouverVisible(contexte, id);
    if (achat.statut === 'annulee') return formater(achat);
    const verifierNonRegle = (montantRegle: string | null) => {
      if (decimal.comparer(montantRegle ?? '0', '0') > 0) {
        throw erreurs.conflit('achat_regle', 'Cet achat est réglé : annuler d’abord ses règlements validés.', {
          montant_regle: montantRegle,
        });
      }
    };
    verifierNonRegle(depuisDecimal(achat.montant_regle));

    await executerTransaction(async (session) => {
      // La condition sur montant_regle sérialise l'annulation avec une validation de règlement concurrente.
      const reservation = await AchatModel.updateOne(
        { _id: id, statut: achat.statut, montant_regle: { $lte: versDecimal('0') } },
        { $set: { statut: 'annulee', motif_annulation: motif, annulee_at: new Date(), annulee_par_id: contexte.utilisateur_id } },
        { session },
      );
      if (reservation.matchedCount === 0) {
        const actuel = await AchatModel.findById(id, { montant_regle: 1 }, { session }).lean<Pick<DocumentAchat, 'montant_regle'>>();
        verifierNonRegle(depuisDecimal(actuel?.montant_regle));
        return;
      }
      if (achat.statut_reception === 'recu') {
        await stockService.contrepasserOrigine({ type: 'achat', id }, motif, contexte, session);
      }
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'annulation', collection: 'achats', document_id: id },
        session,
      );
    });
    return terminerTransition(contexte, id, (a) => a.statut === 'annulee');
  },

  /* Opérations internes appelées par le service Règlements fournisseurs. */

  /** Achat visible pour un règlement : renvoie l'activité et le site à recopier sur le règlement. */
  async lireAchatPourReglement(
    contexte: ContexteSession,
    achatId: string,
  ): Promise<{ statut: StatutOperation; activite: Activite; site_id: string | null }> {
    const achat = await AchatModel.findById(achatId, { statut: 1, activite: 1, site_id: 1 }).lean<
      Pick<DocumentAchat, 'statut' | 'activite' | 'site_id'>
    >();
    if (!achat || !estVisible(contexte, achat)) {
      throw erreurs.donneesInvalides('L’achat indiqué est introuvable.', { champ: 'achat_id' });
    }
    return { statut: achat.statut, activite: achat.activite, site_id: versChaine(achat.site_id) };
  },

  async lireSolde(achatId: string): Promise<{ montant_total: string; montant_regle: string; solde_restant: string }> {
    const achat = await AchatModel.findById(achatId, { montant_total: 1, montant_regle: 1 }).lean<
      Pick<DocumentAchat, 'montant_total' | 'montant_regle'>
    >();
    const total = depuisDecimal(achat?.montant_total) ?? '0';
    const regle = depuisDecimal(achat?.montant_regle) ?? '0';
    return { montant_total: decimal.normaliser(total), montant_regle: decimal.normaliser(regle), solde_restant: decimal.soustraire(total, regle) };
  },

  /**
   * Impute un règlement validé (montant positif) ou annulé (montant négatif) sur l'achat, dans la
   * transaction du règlement. Le $inc sur le document d'achat sérialise les règlements concurrents ;
   * un montant réglé supérieur au total annule la transaction (409 montant_superieur_au_solde).
   */
  async imputerReglement(achatId: string, montant: string, session: ClientSession): Promise<void> {
    const maj = await AchatModel.collection.findOneAndUpdate(
      { _id: new Types.ObjectId(achatId), statut: 'validee' },
      { $inc: { montant_regle: versDecimal(montant) }, $set: { updated_at: new Date() } },
      { session, returnDocument: 'after', projection: { montant_total: 1, montant_regle: 1, statut: 1 } },
    );
    if (!maj) {
      const achat = await AchatModel.findById(achatId, { statut: 1 }, { session }).lean<Pick<DocumentAchat, 'statut'>>();
      throw erreurAchatNonValide(achat?.statut ?? 'annulee');
    }
    const total = depuisDecimal(maj.montant_total as Types.Decimal128)!;
    const regle = depuisDecimal(maj.montant_regle as Types.Decimal128)!;
    if (decimal.comparer(regle, total) > 0) {
      throw erreurs.conflit('montant_superieur_au_solde', 'Le règlement dépasse le solde restant de l’achat.', {
        champ: 'montant',
        solde_restant: decimal.soustraire(total, decimal.soustraire(regle, montant)),
      });
    }
  },
};

async function terminerTransition(
  contexte: ContexteSession,
  id: string,
  attendu: (achat: AchatPublic) => boolean,
): Promise<AchatPublic> {
  const achat = await achatService.consulter(contexte, id);
  if (!attendu(achat)) {
    throw erreurs.conflit('statut_modifie', 'Le statut de l’achat a changé : relire la fiche.', {
      statut: achat.statut,
      statut_reception: achat.statut_reception,
    });
  }
  return achat;
}
