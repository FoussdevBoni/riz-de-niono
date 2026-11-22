import { useChampBrouillon } from '../../hooks/useChampBrouillon';
import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { ChampFormulaire } from '../../components/ChampFormulaire';
import { EnTetePage } from '../../components/EnTetePage';
import { FicheDonnees } from '../../components/FicheDonnees';
import { useEnvoiFormulaire } from '../../hooks/useEnvoiFormulaire';
import { useMessageNavigation } from '../../hooks/useMessageNavigation';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { parametreEntrepriseService } from '../../modules/parametres-entreprise/services/parametreEntrepriseService';
import type { ParametresEntreprise } from '../../modules/parametres-entreprise/types/parametreEntrepriseTypes';
import { formaterDate } from '../../utils/formatage';
import { texteFacultatif } from '../../utils/saisie';

const BASE = '/administration/parametres-entreprise';

/** /administration/parametres-entreprise : coordonnées et devise ; modification avec parametres_entreprise + administration. */
export function ParametresEntreprisePage() {
  const { profil } = useSession();
  const message = useMessageNavigation();
  const requete = useRequete((signal) => parametreEntrepriseService.consulter(signal), []);
  return (
    <section className="page-etroite">
      <EnTetePage
        titre="Paramètres de l’entreprise"
        sousTitre="Coordonnées et devise."
        actions={
          requete.donnees &&
          possedePermission(profil, 'parametres_entreprise', 'administration') && (
            <Link to={`${BASE}/modifier`} className="bouton bouton--secondaire">
              Modifier
            </Link>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des paramètres…">
        {(parametres) => (
          <FicheDonnees
            lignes={[
              ['Nom', parametres.nom],
              ['Adresse', parametres.coordonnees.adresse],
              ['Téléphone', parametres.coordonnees.telephone],
              ['Adresse électronique', parametres.coordonnees.email],
              ['Devise', <code key="devise">{parametres.devise}</code>],
              ['Modifiés le', formaterDate(parametres.updated_at)],
            ]}
          />
        )}
      </BlocRequete>
    </section>
  );
}

const CHAMPS = ['nom', 'adresse', 'telephone', 'email', 'devise', 'coordonnees'] as const;

function FormulaireParametres({ parametres }: { parametres: ParametresEntreprise }) {
  const navigate = useNavigationEdition();
  const [nom, setNom] = useChampBrouillon('nom', parametres.nom);
  const [adresse, setAdresse] = useChampBrouillon('adresse', parametres.coordonnees.adresse ?? '');
  const [telephone, setTelephone] = useChampBrouillon('telephone', parametres.coordonnees.telephone ?? '');
  const [email, setEmail] = useChampBrouillon('email', parametres.coordonnees.email ?? '');
  const [devise, setDevise] = useChampBrouillon('devise', parametres.devise);
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();
  const deviseValide = /^[A-Za-z]{3}$/.test(devise.trim());

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    void executer(async () => {
      await parametreEntrepriseService.modifier({
        nom: nom.trim(),
        // Coordonnées fusionnées côté API ; une saisie vide efface le champ (null).
        coordonnees: { adresse: texteFacultatif(adresse), telephone: texteFacultatif(telephone), email: texteFacultatif(email) },
        devise: devise.trim().toUpperCase(),
      });
      navigate(BASE, { state: { message: 'Paramètres enregistrés.' } });
    });
  }

  const generale = erreurGenerale(CHAMPS);
  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <ChampFormulaire libelle="Nom de l’entreprise" required maxLength={150} value={nom} onChange={(evenement) => setNom(evenement.target.value)} erreur={erreurChamp('nom')} />
      <ChampFormulaire libelle="Adresse" maxLength={300} value={adresse} onChange={(evenement) => setAdresse(evenement.target.value)} erreur={erreurChamp('adresse')} />
      <div className="grille-champs">
        <ChampFormulaire libelle="Téléphone" type="tel" maxLength={30} value={telephone} onChange={(evenement) => setTelephone(evenement.target.value)} erreur={erreurChamp('telephone')} />
        <ChampFormulaire libelle="Adresse électronique" type="email" maxLength={150} value={email} onChange={(evenement) => setEmail(evenement.target.value)} erreur={erreurChamp('email')} />
      </div>
      <ChampFormulaire
        libelle="Devise"
        required
        maxLength={3}
        value={devise}
        onChange={(evenement) => setDevise(evenement.target.value)}
        erreur={erreurChamp('devise')}
        aide={deviseValide ? 'Code ISO 4217 de trois lettres, par exemple XOF.' : 'Trois lettres attendues, par exemple XOF.'}
      />
      <div className="formulaire__actions">
        <Link to={BASE} className="bouton bouton--secondaire">
          Annuler
        </Link>
        <button type="submit" className="bouton" disabled={envoi || !nom.trim() || !deviseValide}>
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

/** /administration/parametres-entreprise/modifier. */
export function ParametresEntrepriseModifierPage() {
  const requete = useRequete((signal) => parametreEntrepriseService.consulter(signal), []);
  return (
    <section className="page-etroite">
      <EnTetePage titre="Modifier les paramètres" />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des paramètres…">
        {(parametres) => <FormulaireParametres parametres={parametres} />}
      </BlocRequete>
    </section>
  );
}
