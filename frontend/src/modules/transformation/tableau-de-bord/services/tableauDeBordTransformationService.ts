import { clientHttp } from '../../../../api/clientHttp';
import type { FiltresTableauTransformation, TableauDeBordTransformation } from '../types/tableauDeBordTransformationTypes';

/** Service du tableau de bord de transformation : GET /api/v1/tableaux-de-bord/transformation. */
export const tableauDeBordTransformationService = {
  consulter: (filtres: FiltresTableauTransformation, signal?: AbortSignal) =>
    clientHttp.get<TableauDeBordTransformation>('/tableaux-de-bord/transformation', { ...filtres }, signal),
};
