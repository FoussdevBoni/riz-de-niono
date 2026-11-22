import type { Activite } from '../../profil/types/profilTypes';

export const LIBELLES_ACTIVITES: Record<Activite, string> = {
  production: 'Production',
  transformation: 'Transformation',
  commercialisation: 'Commercialisation',
};

export const ACTIVITES: Activite[] = ['production', 'transformation', 'commercialisation'];
