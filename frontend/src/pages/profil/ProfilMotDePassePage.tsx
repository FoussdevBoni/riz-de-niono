import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { ChampFormulaire } from '../../components/ChampFormulaire';
import { EnTetePage } from '../../components/EnTetePage';
import { profilService } from '../../modules/profil/services/profilService';
import { champErreur, messageErreur } from '../../utils/erreurs';

const LONGUEUR_MIN = 8;

/** /profil/mot-de-passe : changement du mot de passe ; les autres sessions de l'utilisateur sont fermées. */
export function ProfilMotDePassePage() {
  const [actuel, setActuel] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);
  const [succes, setSucces] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const erreurConfirmation = confirmation && confirmation !== nouveau ? 'Les deux saisies diffèrent.' : null;
  const champ = champErreur(erreur);

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    setSucces(false);
    setEnvoi(true);
    try {
      await profilService.changerMotDePasse(actuel, nouveau);
      setSucces(true);
      setActuel('');
      setNouveau('');
      setConfirmation('');
    } catch (cause) {
      setErreur(cause);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <section className="page-etroite">
      <EnTetePage titre="Changer mon mot de passe" />
      <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
        {succes && <Alerte ton="succes">Mot de passe modifié. Vos autres sessions ont été fermées.</Alerte>}
        {erreur !== null && !champ && <Alerte ton="erreur">{messageErreur(erreur)}</Alerte>}
        <ChampFormulaire
          libelle="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          required
          erreur={champ === 'mot_de_passe_actuel' ? messageErreur(erreur) : null}
          value={actuel}
          onChange={(evenement) => setActuel(evenement.target.value)}
        />
        <ChampFormulaire
          libelle="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          aide={`Au moins ${LONGUEUR_MIN} caractères.`}
          required
          erreur={champ === 'nouveau_mot_de_passe' ? messageErreur(erreur) : null}
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
        <div className="formulaire__actions">
          <Link to="/profil" className="bouton bouton--secondaire">
            Retour au profil
          </Link>
          <button
            type="submit"
            className="bouton"
            disabled={envoi || !actuel || nouveau.length < LONGUEUR_MIN || nouveau !== confirmation}
          >
            {envoi ? 'Enregistrement…' : 'Changer le mot de passe'}
          </button>
        </div>
      </form>
    </section>
  );
}
