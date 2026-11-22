import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { ChampFormulaire } from '../../components/ChampFormulaire';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { destinationAccueil } from '../../navigation/menusNavigation';
import { messageErreur } from '../../utils/erreurs';

/** /connexion : ouverture de session, puis retour vers la page demandée ou l'espace autorisé. */
export function ConnexionPage() {
  const { connecter, sessionExpiree } = useSession();
  const navigate = useNavigationEdition();
  const location = useLocation();
  const depuis = (location.state as { depuis?: string } | null)?.depuis;
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      const profil = await connecter(email, motDePasse);
      navigate(depuis && depuis !== '/connexion' ? depuis : destinationAccueil(profil), { replace: true });
    } catch (cause) {
      setErreur(messageErreur(cause, 'Connexion impossible.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form className="formulaire" onSubmit={soumettre} noValidate>
      <h1 className="formulaire__titre">Connexion</h1>
      <p className="formulaire__intro">Accédez à votre espace de travail Riz de Niono.</p>
      {sessionExpiree && !erreur && (
        <Alerte ton="attention" titre="Session expirée">
          Votre session a pris fin. Reconnectez-vous pour continuer.
        </Alerte>
      )}
      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
      <ChampFormulaire
        libelle="Adresse électronique"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(evenement) => setEmail(evenement.target.value)}
      />
      <ChampFormulaire
        libelle="Mot de passe"
        type="password"
        autoComplete="current-password"
        required
        value={motDePasse}
        onChange={(evenement) => setMotDePasse(evenement.target.value)}
      />
      <button type="submit" className="bouton bouton--large" disabled={envoi || !email || !motDePasse}>
        {envoi ? 'Connexion…' : 'Se connecter'}
      </button>
      <Link to="/mot-de-passe-oublie" className="formulaire__lien">
        Mot de passe oublié ?
      </Link>
    </form>
  );
}
