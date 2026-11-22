import { Link } from 'react-router';

import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';

/**
 * Page d'un module dont l'écran sera livré dans une étape suivante. Sa route est déjà protégée
 * par les mêmes droits que son entrée de menu.
 */
export function PageEnPreparationPage({ titre }: { titre: string }) {
  return (
    <section>
      <EnTetePage titre={titre} />
      <EtatVide titre="Écran en préparation">
        <p>Les données de ce module sont disponibles dans l’API ; leur écran sera livré dans une prochaine étape.</p>
        <Link to="/" className="bouton bouton--secondaire">
          Revenir au tableau de bord
        </Link>
      </EtatVide>
    </section>
  );
}
