import { BarChart3, Factory, ShieldCheck, Sprout, Store } from 'lucide-react';
import { Outlet } from 'react-router';

const PILIERS = [
  { icone: Sprout, titre: 'Production', texte: 'Sites, parcelles, travaux, intrants et récoltes suivis campagne par campagne.' },
  { icone: Factory, titre: 'Transformation', texte: 'Décorticage, rendements usine et stocks de riz blanc en temps réel.' },
  { icone: Store, titre: 'Commercialisation', texte: 'Ventes, clients, encaissements et marges consolidés.' },
] as const;

/** Courbes de niveau évoquant les casiers irrigués, en fond du panneau de présentation. */
function MotifCasiers() {
  return (
    <svg className="public__motif" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {Array.from({ length: 16 }, (_, i) => {
        const y = 40 + i * 52;
        return (
          <path
            key={i}
            d={`M-40 ${y} C 120 ${y - 46 + (i % 3) * 18}, 260 ${y + 54}, 400 ${y + 6} S 620 ${y - 40}, 680 ${y + 12}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={i % 4 === 0 ? 1.2 : 0.7}
          />
        );
      })}
    </svg>
  );
}

/** Espace public : connexion et réinitialisation du mot de passe. */
export function PublicLayout() {
  const annee = new Date().getFullYear();
  return (
    <div className="public">
      <aside className="public__vitrine" aria-label="Présentation de la plateforme">
        <MotifCasiers />
        <div className="public__halo" aria-hidden="true" />

        <div className="public__vitrine-haut">
          <span className="public__pastille">
            <BarChart3 size={14} strokeWidth={2.2} aria-hidden="true" />
            Plateforme de gestion rizicole
          </span>
        </div>

        <div className="public__accroche">
          <h2 className="public__slogan">
            Du champ au marché,
            <br />
            <span>chaque campagne sous contrôle.</span>
          </h2>
          <p className="public__texte">
            Une seule plateforme pour piloter la filière : des données saisies sur le terrain aux indicateurs de direction.
          </p>
          <ul className="public__piliers">
            {PILIERS.map(({ icone: Icone, titre, texte }) => (
              <li key={titre} className="public__pilier">
                <span className="public__pilier-icone" aria-hidden="true">
                  <Icone size={19} strokeWidth={1.9} />
                </span>
                <span>
                  <strong>{titre}</strong>
                  <span>{texte}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="public__vitrine-pied">© {annee} Riz de Niono · Tous droits réservés</p>
      </aside>

      <main className="public__contenu">
        <p className="public__entete-mobile">
          <BarChart3 size={14} strokeWidth={2.2} aria-hidden="true" />
          Plateforme de gestion rizicole
        </p>
        <div className="public__carte">
          <img className="public__logo" src="/logo.jpg" alt="Riz de Niono" width={232} height={116} decoding="async" />
          <Outlet />
        </div>
        <p className="public__securite">
          <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
          Connexion chiffrée · accès réservé aux équipes autorisées
        </p>
      </main>
    </div>
  );
}
