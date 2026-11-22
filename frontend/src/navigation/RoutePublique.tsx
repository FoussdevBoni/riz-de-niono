import { Navigate, Outlet } from 'react-router';

import { IndicateurChargement } from '../components/IndicateurChargement';
import { useSession } from '../modules/authentification/hooks/useSession';
import { destinationAccueil } from './menusNavigation';

/** Pages publiques (connexion, mot de passe oublié) : un utilisateur connecté est renvoyé vers son espace. */
export function RoutePublique() {
  const { etat, profil } = useSession();
  if (etat === 'chargement') {
    return (
      <div className="ecran-centre">
        <IndicateurChargement />
      </div>
    );
  }
  if (etat === 'connecte') return <Navigate to={destinationAccueil(profil)} replace />;
  return <Outlet />;
}
