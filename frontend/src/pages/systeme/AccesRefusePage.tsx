import { Link, useLocation } from 'react-router';

/** /403 : page ouverte sans les droits nécessaires (activité ou permission). */
export function AccesRefusePage() {
  const depuis = (useLocation().state as { depuis?: string } | null)?.depuis;
  return (
    <section className="etat">
      <p className="etat__code">403</p>
      <h1>Accès refusé</h1>
      <p>
        Votre rôle ne donne pas accès à cette page{depuis ? <> (<code>{depuis}</code>)</> : null}. Contactez un administrateur si vous en avez besoin.
      </p>
      <Link to="/" className="bouton">
        Revenir à mon espace
      </Link>
    </section>
  );
}
