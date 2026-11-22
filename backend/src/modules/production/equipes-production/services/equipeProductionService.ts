import { executerTransaction } from '../../../../database/transactionMongo.js';
import { erreurs } from '../../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../../http/pagination/paginationUtils.js';
import type { ContexteSession } from '../../../authentification/services/authentificationService.js';
import { journalOperationService, type ActionJournal } from '../../../journal-operations/services/journalOperationService.js';
import { EquipeProductionModel, type DocumentEquipeProduction } from '../models/equipeProductionModel.js';

export interface EquipeProductionPublique {
  _id: string;
  nom: string;
  membres: string[];
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesEquipeProduction {
  nom?: string;
  membres?: string[];
  actif?: boolean;
}

function formater(equipe: DocumentEquipeProduction): EquipeProductionPublique {
  return {
    _id: String(equipe._id),
    nom: equipe.nom,
    membres: [...equipe.membres],
    actif: equipe.actif,
    created_at: equipe.created_at,
    updated_at: equipe.updated_at,
  };
}

async function trouver(id: string): Promise<DocumentEquipeProduction> {
  const equipe = await EquipeProductionModel.findById(id).lean<DocumentEquipeProduction>();
  if (!equipe) throw erreurs.ressourceIntrouvable('Équipe de production introuvable.');
  return equipe;
}

/**
 * Service du module equipes-production : équipes affectées aux travaux agricoles.
 * Les membres sont des noms saisis ; les journées et coûts sont portés par les opérations agricoles.
 */
export const equipeProductionService = {
  async lister(
    filtres: { actif?: boolean },
    pagination: ParametresPagination,
  ): Promise<PageResultats<EquipeProductionPublique>> {
    const filtre = filtres.actif === undefined ? {} : { actif: filtres.actif };
    const [equipes, total] = await Promise.all([
      EquipeProductionModel.find(filtre)
        .sort({ nom: 1 })
        .skip(pagination.saut)
        .limit(pagination.taille_page)
        .lean<DocumentEquipeProduction[]>(),
      EquipeProductionModel.countDocuments(filtre),
    ]);
    return construirePage(equipes.map(formater), total, pagination);
  },

  async consulter(id: string): Promise<EquipeProductionPublique> {
    return formater(await trouver(id));
  },

  async creer(
    contexte: ContexteSession,
    donnees: { nom: string; membres?: string[] },
  ): Promise<EquipeProductionPublique> {
    const id = await executerTransaction(async (session) => {
      const [equipe] = await EquipeProductionModel.create([{ nom: donnees.nom, membres: donnees.membres ?? [] }], {
        session,
      });
      await journalOperationService.enregistrer(
        {
          utilisateur_id: contexte.utilisateur_id,
          action: 'creation',
          collection: 'equipes_production',
          document_id: String(equipe._id),
        },
        session,
      );
      return String(equipe._id);
    });
    return equipeProductionService.consulter(id);
  },

  async modifier(contexte: ContexteSession, id: string, donnees: DonneesEquipeProduction): Promise<EquipeProductionPublique> {
    const equipe = await trouver(id);
    const modifications: DonneesEquipeProduction = {};
    if (donnees.nom !== undefined) modifications.nom = donnees.nom;
    if (donnees.membres !== undefined) modifications.membres = donnees.membres;
    if (donnees.actif !== undefined && donnees.actif !== equipe.actif) modifications.actif = donnees.actif;
    if (Object.keys(modifications).length === 0) return formater(equipe);

    const action: ActionJournal =
      modifications.actif === undefined ? 'modification' : modifications.actif ? 'reactivation' : 'archivage';
    await executerTransaction(async (session) => {
      await EquipeProductionModel.updateOne({ _id: id }, { $set: modifications }, { session });
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action, collection: 'equipes_production', document_id: id },
        session,
      );
    });
    return equipeProductionService.consulter(id);
  },

  /* Opérations internes appelées par le service Opérations agricoles. */

  async verifierEquipeAttribuable(id: string): Promise<void> {
    if (!(await EquipeProductionModel.exists({ _id: id, actif: true }))) {
      throw erreurs.donneesInvalides('L’équipe indiquée est introuvable ou archivée.', { champ: 'equipe_id' });
    }
  },
};
