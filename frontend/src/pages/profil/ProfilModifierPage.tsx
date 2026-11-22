import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { ChampFormulaire } from '../../components/ChampFormulaire';
import { EnTetePage } from '../../components/EnTetePage';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { profilService } from '../../modules/profil/services/profilService';
import { messageErreur } from '../../utils/erreurs';

/** /profil/modifier : modification du nom affiché. */
export function ProfilModifierPage() {
  const { profil, mettreAJourProfil } = useSession();
  const navigate = useNavigationEdition();
  const [nom, setNom] = useState(profil?.nom ?? '');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      mettreAJourProfil(await profilService.modifier({ nom: nom.trim() }));
      navigate('/profil');
    } catch (cause) {
      setErreur(messageErreur(cause));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <section className="page-etroite">
      <EnTetePage titre="Modifier mon nom" />
      <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
        <ChampFormulaire libelle="Nom" required maxLength={100} value={nom} onChange={(evenement) => setNom(evenement.target.value)} />
        <div className="formulaire__actions">
          <Link to="/profil" className="bouton bouton--secondaire">
            Annuler
          </Link>
          <button type="submit" className="bouton" disabled={envoi || !nom.trim()}>
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </section>
  );
}
