import { clientHttp } from '../../../../api/clientHttp';
import type { FiltresTableauCommercialisation, TableauDeBordCommercialisation } from '../types/tableauDeBordCommercialisationTypes';

/** Service du tableau de bord commercial : GET /api/v1/tableaux-de-bord/commercialisation. */
export const tableauDeBordCommercialisationService = {
  consulter: (filtres: FiltresTableauCommercialisation, signal?: AbortSignal) =>
    clientHttp.get<TableauDeBordCommercialisation>('/tableaux-de-bord/commercialisation', { ...filtres }, signal),
};
