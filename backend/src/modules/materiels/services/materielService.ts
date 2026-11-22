import { baseCodeDepuisNom, creerAvecCodeUnique, premierCodeLibre } from '../../../database/codesInternes.js';
import { decimal, depuisDecimal, versDecimal } from '../../../database/decimalMongo.js';
import { estErreurDoublon } from '../../../database/erreursMongo.js';
import { executerTransaction } from '../../../database/transactionMongo.js';
import { erreurs } from '../../../http/erreurs/erreurApplication.js';
import { construirePage, type PageResultats, type ParametresPagination } from '../../../http/pagination/paginationUtils.js';
import type { ContexteSession } from '../../authentification/services/authentificationService.js';
import { journalOperationService, type ActionJournal } from '../../journal-operations/services/journalOperationService.js';
import type { Activite } from '../../utilisateurs/services/utilisateurService.js';
import { MaterielModel, type DocumentMateriel } from '../models/materielModel.js';

export interface MaterielPublic {
  _id: string;
  code: string;
  nom: string;
  activites: Activite[];
  quantite_totale: string;
  quantite_disponible: string;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DonneesMateriel {
  code?: string;
  nom?: string;
  activites?: Activite[];
  quantite_totale?: string;
  quantite_disponible?: string;
  actif?: boolean;
}

function formater(materiel: DocumentMateriel): MaterielPublic {
  return {
    _id: String(materiel._id),
    code: materiel.code,
    nom: materiel.nom,
    activites: [...materiel.activites],
    quantite_totale: decimal.normaliser(depuisDecimal(materiel.quantite_totale)!),
    quantite_disponible: decimal.normaliser(depuisDecimal(materiel.quantite_disponible)!),
    actif: materiel.actif,
    created_at: materiel.created_at,
    updated_at: materiel.updated_at,
  };
}

/** Matériel visible s'il sert au moins une activité de la session ; sinon 404. */
async function trouverVisible(contexte: ContexteSession, id: string): Promise<DocumentMateriel> {
  const materiel = await MaterielModel.findById(id).lean<DocumentMateriel>();
  if (!materiel || !materiel.activites.some((activite) => contexte.activites.includes(activite))) {
    throw erreurs.ressourceIntrouvable('Matériel introuvable.');
  }
  return materiel;
}

function verifierQuantites(totale: string, disponible: string): void {
  if (decimal.comparer(disponible, totale) > 0) {
    throw erreurs.donneesInvalides('La quantité disponible doit être comprise entre zéro et la quantité totale.', {
      champ: 'quantite_disponible',
    });
  }
}

function verifierActivites(contexte: ContexteSession, avant: readonly Activite[], apres: readonly Activite[]): void {
  if (apres.length === 0) throw erreurs.donneesInvalides('Indiquer au moins une activité utilisant le matériel.', { champ: 'activites' });
  const changees = [...apres.filter((a) => !avant.includes(a)), ...avant.filter((a) => !apres.includes(a))];
  const horsPerimetre = changees.filter((activite) => !contexte.activites.includes(activite));
  if (horsPerimetre.length > 0) {
    throw erreurs.accesRefuse(`Vous ne pouvez pas modifier l'usage du matériel pour : ${horsPerimetre.join(', ')}.`);
  }
}

function erreurCodeDejaUtilise() {
  return erreurs.conflit('code_deja_utilise', 'Ce code de matériel est déjà utilisé.', { champ: 'code' });
}

/**
 * Service du module materiels : registre des équipements et de leurs quantités disponibles,
 * partagé par les activités selon le champ activites (même règle de périmètre que les produits).
 */
export const materielService = {
  async lister(
    contexte: ContexteSession,
    filtres: { activite?: Activite },
    pagination: ParametresPagination,
  ): Promise<PageResultats<MaterielPublic>> {
    if (filtres.activite && !contexte.activites.includes(filtres.activite)) {
      throw erreurs.accesRefuse(`Votre périmètre n'inclut pas l'activité ${filtres.activite}.`);
    }
    const filtre = { activites: filtres.activite ?? { $in: contexte.activites } };
    const [materiels, total] = await Promise.all([
      MaterielModel.find(filtre).sort({ nom: 1 }).skip(pagination.saut).limit(pagination.taille_page).lean<DocumentMateriel[]>(),
      MaterielModel.countDocuments(filtre),
    ]);
    return construirePage(materiels.map(formater), total, pagination);
  },

  async consulter(contexte: ContexteSession, id: string): Promise<MaterielPublic> {
    return formater(await trouverVisible(contexte, id));
  },

  /** Code libre proposé à partir du nom saisi ; il n'est réservé qu'à la création. */
  async proposerCode(nom: string | undefined): Promise<{ code: string }> {
    return { code: await premierCodeLibre(MaterielModel as never, baseCodeDepuisNom(nom, 'MATERIEL')) };
  },

  async creer(
    contexte: ContexteSession,
    donnees: Required<Omit<DonneesMateriel, 'actif' | 'code'>> & { code?: string },
  ): Promise<MaterielPublic> {
    verifierActivites(contexte, [], donnees.activites);
    verifierQuantites(donnees.quantite_totale, donnees.quantite_disponible);
    const id = await creerAvecCodeUnique({
      modele: MaterielModel as never,
      codeFourni: donnees.code,
      nom: donnees.nom,
      prefixe: 'MATERIEL',
      erreurDoublon: erreurCodeDejaUtilise,
      creer: (code) => executerTransaction(async (session) => {
        const [materiel] = await MaterielModel.create(
          [
            {
              code,
              nom: donnees.nom,
              activites: donnees.activites,
              quantite_totale: versDecimal(donnees.quantite_totale),
              quantite_disponible: versDecimal(donnees.quantite_disponible),
            },
          ],
          { session },
        );
        await journalOperationService.enregistrer(
          { utilisateur_id: contexte.utilisateur_id, action: 'creation', collection: 'materiels', document_id: String(materiel._id) },
          session,
        );
        return String(materiel._id);
      }),
    });
    return materielService.consulter(contexte, id);
  },

  async modifier(contexte: ContexteSession, id: string, donnees: DonneesMateriel): Promise<MaterielPublic> {
    const materiel = await trouverVisible(contexte, id);
    const modifications: Record<string, unknown> = {};
    if (donnees.code !== undefined && donnees.code !== materiel.code) {
      if (await MaterielModel.exists({ code: donnees.code })) throw erreurCodeDejaUtilise();
      modifications.code = donnees.code;
    }
    if (donnees.nom !== undefined) modifications.nom = donnees.nom;
    if (donnees.activites !== undefined) {
      verifierActivites(contexte, materiel.activites, donnees.activites);
      modifications.activites = donnees.activites;
    }
    if (donnees.quantite_totale !== undefined || donnees.quantite_disponible !== undefined) {
      const totale = donnees.quantite_totale ?? depuisDecimal(materiel.quantite_totale)!;
      const disponible = donnees.quantite_disponible ?? depuisDecimal(materiel.quantite_disponible)!;
      verifierQuantites(totale, disponible);
      modifications.quantite_totale = versDecimal(totale);
      modifications.quantite_disponible = versDecimal(disponible);
    }
    if (donnees.actif !== undefined && donnees.actif !== materiel.actif) modifications.actif = donnees.actif;
    if (Object.keys(modifications).length === 0) return formater(materiel);

    const action: ActionJournal =
      modifications.actif === undefined ? 'modification' : modifications.actif ? 'reactivation' : 'archivage';
    try {
      await executerTransaction(async (session) => {
        await MaterielModel.updateOne({ _id: id }, { $set: modifications }, { session });
        await journalOperationService.enregistrer(
          { utilisateur_id: contexte.utilisateur_id, action, collection: 'materiels', document_id: id },
          session,
        );
      });
    } catch (erreur) {
      if (estErreurDoublon(erreur)) throw erreurCodeDejaUtilise();
      throw erreur;
    }
    return materielService.consulter(contexte, id);
  },

  /* Opérations internes appelées par le service Dépenses. */

  /** Matériel actif utilisé par l'activité de la dépense. */
  async verifierMaterielAttribuable(id: string, activite: Activite): Promise<void> {
    if (!(await MaterielModel.exists({ _id: id, actif: true, activites: activite }))) {
      throw erreurs.donneesInvalides(`Le matériel indiqué est introuvable, archivé ou non utilisé en ${activite}.`, { champ: 'materiel_id' });
    }
  },
};
