import { clientHttp } from '../../../../api/clientHttp';
import type { FiltresTableauProduction, TableauDeBordProduction } from '../types/tableauDeBordProductionTypes';

/** Service du tableau de bord de production : GET /api/v1/tableaux-de-bord/production. */
export const tableauDeBordProductionService = {
  consulter: (filtres: FiltresTableauProduction, signal?: AbortSignal) =>
    clientHttp.get<TableauDeBordProduction>('/tableaux-de-bord/production', { ...filtres }, signal),
};
