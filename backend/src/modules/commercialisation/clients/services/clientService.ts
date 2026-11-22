import { executerTransaction } from '../../../../database/transactionMongo.js';
import { erreurs } from '../../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import type { ContexteSession } from '../../../authentification/services/authentificationService.js';
import { journalOperationService, type ActionJournal } from '../../../journal-operations/services/journalOperationService.js';
import { venteService } from '../../../ventes/services/venteService.js';
import { ClientModel, type DocumentClient } from '../models/clientModel.js';

export interface ClientPublic {
  _id: string;
  nom: string;
  telephone: string | null;
  adresse: string | null;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

/** Fiche client : coordonnées et situation des ventes validées visibles par l'utilisateur. */
export interface FicheClient extends ClientPublic {
  ventes: { montant_total: string; montant_encaisse: string; montant_retours: string; solde: string; trop_percu: string };
}

export interface DonneesClient {
  nom?: string;
  telephone?: string | null;
  adresse?: string | null;
  actif?: boolean;
}

function formater(client: DocumentClient): ClientPublic {
  return {
    _id: String(client._id),
    nom: client.nom,
    telephone: client.telephone ?? null,
    adresse: client.adresse ?? null,
    actif: client.actif,
    created_at: client.created_at,
    updated_at: client.updated_at,
  };
}

async function trouver(id: string): Promise<DocumentClient> {
  const client = await ClientModel.findById(id).lean<DocumentClient>();
  if (!client) throw erreurs.ressourceIntrouvable('Client introuvable.');
  return client;
}

/**
 * Service du module clients : fiches utilisées par les ventes de production et la commercialisation.
 * Commandes, ventes et encaissements du client se consultent par leurs filtres client_id / vente_id.
 * Un client archivé reste lié à ses ventes mais ne peut plus recevoir de nouvelle commande ni vente.
 */
export const clientService = {
  async lister(filtres: { actif?: boolean }, pagination: ParametresPagination): Promise<PageResultats<ClientPublic>> {
    const filtre = filtres.actif === undefined ? {} : { actif: filtres.actif };
    const [clients, total] = await Promise.all([
      ClientModel.find(filtre).sort({ nom: 1 }).skip(pagination.saut).limit(pagination.taille_page).lean<DocumentClient[]>(),
      ClientModel.countDocuments(filtre),
    ]);
    return construirePage(clients.map(formater), total, pagination);
  },

  async consulter(contexte: ContexteSession, id: string): Promise<FicheClient> {
    const client = await trouver(id);
    return { ...formater(client), ventes: await venteService.lireSituationClient(contexte, id) };
  },

  async creer(contexte: ContexteSession, donnees: { nom: string } & DonneesClient): Promise<FicheClient> {
    const id = await executerTransaction(async (session) => {
      const [client] = await ClientModel.create(
        [{ nom: donnees.nom, telephone: donnees.telephone ?? null, adresse: donnees.adresse ?? null }],
        { session },
      );
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'creation', collection: 'clients', document_id: String(client._id) },
        session,
      );
      return String(client._id);
    });
    return clientService.consulter(contexte, id);
  },

  async modifier(contexte: ContexteSession, id: string, donnees: DonneesClient): Promise<FicheClient> {
    const client = await trouver(id);
    const modifications: DonneesClient = {};
    if (donnees.nom !== undefined) modifications.nom = donnees.nom;
    if (donnees.telephone !== undefined) modifications.telephone = donnees.telephone;
    if (donnees.adresse !== undefined) modifications.adresse = donnees.adresse;
    if (donnees.actif !== undefined && donnees.actif !== client.actif) modifications.actif = donnees.actif;
    if (Object.keys(modifications).length > 0) {
      const action: ActionJournal =
        modifications.actif === undefined ? 'modification' : modifications.actif ? 'reactivation' : 'archivage';
      await executerTransaction(async (session) => {
        await ClientModel.updateOne({ _id: id }, { $set: modifications }, { session });
        await journalOperationService.enregistrer(
          { utilisateur_id: contexte.utilisateur_id, action, collection: 'clients', document_id: id },
          session,
        );
      });
    }
    return clientService.consulter(contexte, id);
  },

  /* Opérations internes appelées par les services Commandes clients et Ventes. */

  async verifierClientAttribuable(id: string): Promise<void> {
    if (!(await ClientModel.exists({ _id: id, actif: true }))) {
      throw erreurs.donneesInvalides('Le client indiqué est introuvable ou archivé.', { champ: 'client_id' });
    }
  },
};
