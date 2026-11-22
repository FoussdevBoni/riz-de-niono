import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { ChampFormulaire } from '../../components/ChampFormulaire';
import { useNavigationEdition } from '../../hooks/useNavigationEdition';
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
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [majusculesVerrouillees, setMajusculesVerrouillees] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  function surveillerMajuscules(evenement: KeyboardEvent<HTMLInputElement>) {
    setMajusculesVerrouillees(evenement.getModifierState('CapsLock'));
  }

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    if (!email.trim() || !motDePasse) {
      setErreur('Renseignez votre adresse électronique et votre mot de passe.');
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      const profil = await connecter(email.trim(), motDePasse);
      navigate(depuis && depuis !== '/connexion' ? depuis : destinationAccueil(profil), { replace: true });
    } catch (cause) {
      setErreur(messageErreur(cause, 'Connexion impossible.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form className="formulaire formulaire--public" onSubmit={soumettre} noValidate aria-busy={envoi}>
      <div className="formulaire__entete">
        <h1 className="formulaire__titre">Connexion</h1>
        <p className="formulaire__intro">Accédez à votre espace de pilotage Riz de Niono.</p>
      </div>
      {sessionExpiree && !erreur && (
        <Alerte ton="attention" titre="Session expirée">
          Votre session a pris fin. Reconnectez-vous pour continuer.
        </Alerte>
      )}
      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
      <ChampFormulaire
        libelle="Adresse électronique"
        type="email"
        icone={Mail}
        placeholder="nom@entreprise.com"
        autoComplete="username"
        inputMode="email"
        autoFocus
        required
        value={email}
        onChange={(evenement) => setEmail(evenement.target.value)}
      />
      <div className="formulaire__groupe">
        <ChampFormulaire
          libelle="Mot de passe"
          type={motDePasseVisible ? 'text' : 'password'}
          icone={LockKeyhole}
          placeholder="Votre mot de passe"
          autoComplete="current-password"
          required
          value={motDePasse}
          onChange={(evenement) => setMotDePasse(evenement.target.value)}
          onKeyUp={surveillerMajuscules}
          onKeyDown={surveillerMajuscules}
          aide={majusculesVerrouillees ? 'Le verrouillage des majuscules est activé.' : undefined}
          suffixe={
            <button
              type="button"
              className="champ__bouton-icone"
              onClick={() => setMotDePasseVisible((visible) => !visible)}
              aria-label={motDePasseVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={motDePasseVisible}
            >
              {motDePasseVisible ? <EyeOff size={17} strokeWidth={1.9} /> : <Eye size={17} strokeWidth={1.9} />}
            </button>
          }
        />
        <Link to="/mot-de-passe-oublie" className="formulaire__lien-discret">
          Mot de passe oublié ?
        </Link>
      </div>
      <button type="submit" className="bouton bouton--large bouton--principal" disabled={envoi}>
        {envoi ? (
          <>
            <LoaderCircle className="icone-rotation" size={18} aria-hidden="true" />
            Connexion en cours…
          </>
        ) : (
          <>
            Se connecter
            <ArrowRight className="bouton__fleche" size={18} aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}
