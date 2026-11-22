import { executerTransaction } from '../../../database/transactionMongo.js';
import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../http/pagination/paginationUtils.js';
import type { ContexteSession } from '../../authentification/services/authentificationService.js';
import { journalOperationService, type ActionJournal } from '../../journal-operations/services/journalOperationService.js';
import { FournisseurModel, type DocumentFournisseur } from '../models/fournisseurModel.js';

export interface FournisseurPublic {
  _id: string;
  nom: string;
  telephone: string | null;
  adresse: string | null;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesFournisseur {
  nom?: string;
  telephone?: string | null;
  adresse?: string | null;
  actif?: boolean;
}

function formater(fournisseur: DocumentFournisseur): FournisseurPublic {
  return {
    _id: String(fournisseur._id),
    nom: fournisseur.nom,
    telephone: fournisseur.telephone ?? null,
    adresse: fournisseur.adresse ?? null,
    actif: fournisseur.actif,
    created_at: fournisseur.created_at,
    updated_at: fournisseur.updated_at,
  };
}

async function trouver(id: string): Promise<DocumentFournisseur> {
  const fournisseur = await FournisseurModel.findById(id).lean<DocumentFournisseur>();
  if (!fournisseur) throw erreurs.ressourceIntrouvable('Fournisseur introuvable.');
  return fournisseur;
}

/**
 * Service du module fournisseurs : fiche commune aux trois activités.
 * Les achats d'un fournisseur se consultent par GET /achats?fournisseur_id=, dans le périmètre de l'utilisateur.
 * Un fournisseur archivé reste lié à ses achats mais ne peut plus en recevoir de nouveaux.
 */
export const fournisseurService = {
  async lister(filtres: { actif?: boolean }, pagination: ParametresPagination): Promise<PageResultats<FournisseurPublic>> {
    const filtre = filtres.actif === undefined ? {} : { actif: filtres.actif };
    const [fournisseurs, total] = await Promise.all([
      FournisseurModel.find(filtre).sort({ nom: 1 }).skip(pagination.saut).limit(pagination.taille_page).lean<DocumentFournisseur[]>(),
      FournisseurModel.countDocuments(filtre),
    ]);
    return construirePage(fournisseurs.map(formater), total, pagination);
  },

  async consulter(id: string): Promise<FournisseurPublic> {
    return formater(await trouver(id));
  },

  async creer(contexte: ContexteSession, donnees: { nom: string } & DonneesFournisseur): Promise<FournisseurPublic> {
    const id = await executerTransaction(async (session) => {
      const [fournisseur] = await FournisseurModel.create(
        [{ nom: donnees.nom, telephone: donnees.telephone ?? null, adresse: donnees.adresse ?? null }],
        { session },
      );
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'creation', collection: 'fournisseurs', document_id: String(fournisseur._id) },
        session,
      );
      return String(fournisseur._id);
    });
    return fournisseurService.consulter(id);
  },

  async modifier(contexte: ContexteSession, id: string, donnees: DonneesFournisseur): Promise<FournisseurPublic> {
    const fournisseur = await trouver(id);
    const modifications: DonneesFournisseur = {};
    if (donnees.nom !== undefined) modifications.nom = donnees.nom;
    if (donnees.telephone !== undefined) modifications.telephone = donnees.telephone;
    if (donnees.adresse !== undefined) modifications.adresse = donnees.adresse;
    if (donnees.actif !== undefined && donnees.actif !== fournisseur.actif) modifications.actif = donnees.actif;
    if (Object.keys(modifications).length === 0) return formater(fournisseur);

    const action: ActionJournal =
      modifications.actif === undefined ? 'modification' : modifications.actif ? 'reactivation' : 'archivage';
    await executerTransaction(async (session) => {
      await FournisseurModel.updateOne({ _id: id }, { $set: modifications }, { session });
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action, collection: 'fournisseurs', document_id: id },
        session,
      );
    });
    return fournisseurService.consulter(id);
  },

  /* Opérations internes appelées par le service Achats. */

  async verifierFournisseurAttribuable(id: string): Promise<void> {
    if (!(await FournisseurModel.exists({ _id: id, actif: true }))) {
      throw erreurs.donneesInvalides('Le fournisseur indiqué est introuvable ou archivé.', { champ: 'fournisseur_id' });
    }
  },
};
