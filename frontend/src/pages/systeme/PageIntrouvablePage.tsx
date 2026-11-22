import { Link } from 'react-router';

export function PageIntrouvablePage() {
  return (
    <section className="etat">
      <p className="etat__code">404</p>
      <h1>Page introuvable</h1>
      <p>Cette adresse ne correspond à aucune page de l'application.</p>
      <Link to="/" className="bouton">
        Revenir à mon espace
      </Link>
    </section>
  );
}
