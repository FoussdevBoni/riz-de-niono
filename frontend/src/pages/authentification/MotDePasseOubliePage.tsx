import { Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { ChampFormulaire } from '../../components/ChampFormulaire';
import { authentificationService } from '../../modules/authentification/services/authentificationService';
import { messageErreur } from '../../utils/erreurs';

/** /mot-de-passe-oublie : demande d'un lien de réinitialisation, avec une réponse identique pour toute adresse. */
export function MotDePasseOubliePage() {
  const [email, setEmail] = useState('');
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await authentificationService.demanderReinitialisation(email);
      setEnvoye(true);
    } catch (cause) {
      setErreur(messageErreur(cause, 'La demande n’a pas pu être envoyée.'));
    } finally {
      setEnvoi(false);
    }
  }

  if (envoye) {
    return (
      <div className="formulaire">
        <h1 className="formulaire__titre">Demande envoyée</h1>
        <Alerte ton="succes">
          Si un compte correspond à <strong>{email}</strong>, un lien de réinitialisation vient d’être envoyé. Il est valable 60 minutes.
        </Alerte>
        <Link to="/connexion" className="bouton bouton--secondaire bouton--large">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form className="formulaire" onSubmit={soumettre} noValidate>
      <h1 className="formulaire__titre">Mot de passe oublié</h1>
      <p className="formulaire__intro">Indiquez votre adresse : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
      <ChampFormulaire
        libelle="Adresse électronique"
        type="email"
        icone={Mail}
        placeholder="nom@entreprise.com"
        autoComplete="email"
        required
        value={email}
        onChange={(evenement) => setEmail(evenement.target.value)}
      />
      <button type="submit" className="bouton bouton--large bouton--principal" disabled={envoi || !email}>
        {envoi ? 'Envoi…' : 'Recevoir le lien'}
      </button>
      <Link to="/connexion" className="formulaire__lien">
        Retour à la connexion
      </Link>
    </form>
  );
}
