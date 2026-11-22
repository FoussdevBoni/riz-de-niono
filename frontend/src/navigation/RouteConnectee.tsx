import { Navigate, Outlet, useLocation } from 'react-router';

import { IndicateurChargement } from '../components/IndicateurChargement';
import { useSession } from '../modules/authentification/hooks/useSession';

/** Espace connecté : sans session (absente ou expirée), retour à la connexion en mémorisant la page demandée. */
export function RouteConnectee() {
  const { etat } = useSession();
  const location = useLocation();
  if (etat === 'chargement') {
    return (
      <div className="ecran-centre">
        <IndicateurChargement libelle="Ouverture de votre session…" />
      </div>
    );
  }
  if (etat === 'deconnecte') {
    return <Navigate to="/connexion" replace state={{ depuis: `${location.pathname}${location.search}` }} />;
  }
  return <Outlet />;
}
