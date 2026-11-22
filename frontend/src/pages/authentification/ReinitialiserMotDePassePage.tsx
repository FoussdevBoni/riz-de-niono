import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { ChampFormulaire } from '../../components/ChampFormulaire';
import { authentificationService } from '../../modules/authentification/services/authentificationService';
import { codeErreur, messageErreur } from '../../utils/erreurs';

const LONGUEUR_MIN = 8;

/** /reinitialiser-mot-de-passe?jeton=… : choix du nouveau mot de passe depuis le lien reçu par e-mail. */
export function ReinitialiserMotDePassePage() {
  const [parametres] = useSearchParams();
  const jeton = parametres.get('jeton');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [termine, setTermine] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const erreurConfirmation = confirmation && confirmation !== nouveau ? 'Les deux saisies diffèrent.' : null;

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || erreurConfirmation) return;
    setErreur(null);
    setEnvoi(true);
    try {
      await authentificationService.confirmerReinitialisation(jeton, nouveau);
      setTermine(true);
    } catch (cause) {
      setErreur(
        codeErreur(cause) === 'jeton_invalide'
          ? 'Ce lien est invalide, déjà utilisé ou expiré. Demandez-en un nouveau.'
          : messageErreur(cause, 'Le mot de passe n’a pas pu être changé.'),
      );
    } finally {
      setEnvoi(false);
    }
  }

  if (!jeton) {
    return (
      <div className="formulaire">
        <h1 className="formulaire__titre">Lien incomplet</h1>
        <Alerte ton="erreur">Ce lien ne contient pas de jeton de réinitialisation.</Alerte>
        <Link to="/mot-de-passe-oublie" className="bouton bouton--large">
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  if (termine) {
    return (
      <div className="formulaire">
        <h1 className="formulaire__titre">Mot de passe modifié</h1>
        <Alerte ton="succes">Votre nouveau mot de passe est enregistré. Vos sessions ouvertes ont été fermées.</Alerte>
        <Link to="/connexion" className="bouton bouton--large">
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <form className="formulaire" onSubmit={soumettre} noValidate>
      <h1 className="formulaire__titre">Nouveau mot de passe</h1>
      {erreur && (
        <Alerte ton="erreur">
          {erreur} <Link to="/mot-de-passe-oublie">Nouvelle demande</Link>
        </Alerte>
      )}
      <ChampFormulaire
        libelle="Nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        aide={`Au moins ${LONGUEUR_MIN} caractères.`}
        minLength={LONGUEUR_MIN}
        required
        value={nouveau}
        onChange={(evenement) => setNouveau(evenement.target.value)}
      />
      <ChampFormulaire
        libelle="Confirmation"
        type="password"
        autoComplete="new-password"
        required
        erreur={erreurConfirmation}
        value={confirmation}
        onChange={(evenement) => setConfirmation(evenement.target.value)}
      />
      <button type="submit" className="bouton bouton--large" disabled={envoi || nouveau.length < LONGUEUR_MIN || nouveau !== confirmation}>
        {envoi ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
      </button>
    </form>
  );
}
