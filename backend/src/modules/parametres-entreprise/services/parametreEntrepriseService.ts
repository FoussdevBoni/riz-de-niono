import { executerTransaction } from '../../../database/transactionMongo.js';
import type { ContexteSession } from '../../authentification/services/authentificationService.js';
import { journalOperationService } from '../../journal-operations/services/journalOperationService.js';
import { ParametreEntrepriseModel, type Coordonnees, type DocumentParametreEntreprise } from '../models/parametreEntrepriseModel.js';
import { CODE_PARAMETRES } from '../schemas/parametreEntrepriseSchema.js';

export type { Coordonnees };

export interface ParametresEntreprisePublics {
  _id: string;
  nom: string;
  coordonnees: Coordonnees;
  devise: string;
  updated_at: Date;
}

export interface DonneesParametres {
  nom?: string;
  /** Champs transmis fusionnés avec les coordonnées existantes ; null efface un champ. */
  coordonnees?: Partial<Coordonnees>;
  devise?: string;
}

const VALEURS_INITIALES = { nom: 'Riz de Niono', devise: 'XOF' };

function formater(parametres: DocumentParametreEntreprise): ParametresEntreprisePublics {
  return {
    _id: String(parametres._id),
    nom: parametres.nom,
    coordonnees: {
      adresse: parametres.coordonnees?.adresse ?? null,
      telephone: parametres.coordonnees?.telephone ?? null,
      email: parametres.coordonnees?.email ?? null,
    },
    devise: parametres.devise,
    updated_at: parametres.updated_at,
  };
}

async function lireDocument(): Promise<DocumentParametreEntreprise> {
  await parametreEntrepriseService.assurerParametres();
  return (await ParametreEntrepriseModel.findOne({ code: CODE_PARAMETRES }).lean<DocumentParametreEntreprise>())!;
}

/**
 * Service du module parametres-entreprise : un document unique (code PRINCIPAL) avec le nom,
 * les coordonnées et la devise de l'entreprise, créé avec des valeurs initiales s'il manque.
 */
export const parametreEntrepriseService = {
  async consulter(): Promise<ParametresEntreprisePublics> {
    return formater(await lireDocument());
  },

  async modifier(contexte: ContexteSession, donnees: DonneesParametres): Promise<ParametresEntreprisePublics> {
    const actuel = await lireDocument();
    const modifications: Record<string, unknown> = {};
    if (donnees.nom !== undefined) modifications.nom = donnees.nom;
    if (donnees.devise !== undefined) modifications.devise = donnees.devise;
    for (const [champ, valeur] of Object.entries(donnees.coordonnees ?? {})) {
      if (valeur !== undefined) modifications[`coordonnees.${champ}`] = valeur;
    }
    if (Object.keys(modifications).length === 0) return formater(actuel);
    await executerTransaction(async (session) => {
      await ParametreEntrepriseModel.updateOne({ code: CODE_PARAMETRES }, { $set: modifications }, { session });
      await journalOperationService.enregistrer(
        { utilisateur_id: contexte.utilisateur_id, action: 'modification', collection: 'parametres_entreprise', document_id: String(actuel._id) },
        session,
      );
    });
    return parametreEntrepriseService.consulter();
  },

  /** Crée le document des paramètres avec ses valeurs initiales s'il n'existe pas. Idempotent. */
  async assurerParametres(): Promise<void> {
    await ParametreEntrepriseModel.updateOne(
      { code: CODE_PARAMETRES },
      { $setOnInsert: { ...VALEURS_INITIALES, coordonnees: { adresse: null, telephone: null, email: null } } },
      { upsert: true },
    );
  },
};
