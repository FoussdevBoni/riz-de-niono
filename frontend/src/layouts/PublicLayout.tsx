import { Wheat } from 'lucide-react';
import { Outlet } from 'react-router';

/** Espace public : connexion et réinitialisation du mot de passe. */
export function PublicLayout() {
  return (
    <div className="public">
      <aside className="public__illustration" aria-hidden="true">
        <div className="public__accroche">
          <span className="marque__symbole marque__symbole--grand" aria-hidden="true"><Wheat size={28} strokeWidth={2.2} /></span>
          <p className="public__slogan">Du champ au marché, une seule vue sur la campagne.</p>
          <p className="public__activites">Production · Transformation · Commercialisation</p>
        </div>
      </aside>
      <main className="public__contenu">
        <div className="public__carte">
          <div className="marque marque--grande">
            <span className="marque__symbole" aria-hidden="true"><Wheat size={20} strokeWidth={2.2} /></span>
            <span className="marque__nom">Riz de Niono</span>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
