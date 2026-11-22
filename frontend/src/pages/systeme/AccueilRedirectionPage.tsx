import { Navigate } from 'react-router';

import { useSession } from '../../modules/authentification/hooks/useSession';
import { destinationAccueil } from '../../navigation/menusNavigation';

/** / : redirection vers l'espace autorisé (tableau de bord du premier espace accessible). */
export function AccueilRedirectionPage() {
  const { profil } = useSession();
  return <Navigate to={destinationAccueil(profil)} replace />;
}
