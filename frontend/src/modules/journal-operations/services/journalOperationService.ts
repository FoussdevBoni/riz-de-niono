import { clientHttp, type PageResultats, type ParametresRequete } from '../../../api/clientHttp';
import type { EvenementJournal, FicheEvenementJournal } from '../types/journalOperationTypes';

/**
 * Service du module journal-operations : endpoints /api/v1/journal-operations (document 04), en lecture seule.
 * Seuls les événements des modules que l'utilisateur consulte sont renvoyés.
 */
export const journalOperationService = {
  lister: (parametres: ParametresRequete = {}, signal?: AbortSignal) =>
    clientHttp.get<PageResultats<EvenementJournal>>('/journal-operations', parametres, signal),
  consulter: (id: string, signal?: AbortSignal) => clientHttp.get<FicheEvenementJournal>(`/journal-operations/${id}`, undefined, signal),
};
