import { useChampBrouillon } from '../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from './Alerte';
import { ChampFormulaire } from './ChampFormulaire';
import { useEnvoiFormulaire } from '../hooks/useEnvoiFormulaire';
import { texteFacultatif } from '../utils/saisie';

/** Coordonnées d'un tiers (fournisseur ou client) : mêmes champs et mêmes règles dans le document 04. */
export interface Coordonnees {
  nom: string;
  telephone: string | null;
  adresse: string | null;
}

export interface DonneesCoordonnees {
  nom?: string;
  telephone?: string | null;
  adresse?: string | null;
}

const CHAMPS = ['nom', 'telephone', 'adresse'] as const;

/** Formulaire de coordonnées : nom, téléphone et adresse facultatifs (une saisie vide efface la valeur). */
export function CoordonneesFormulaire({
  tiers,
  retour,
  onAnnuler,
  onEnregistrer,
}: {
  tiers?: Coordonnees;
  retour: string;
  onAnnuler?: () => void;
  onEnregistrer: (donnees: DonneesCoordonnees) => Promise<void>;
}) {
  const [nom, setNom] = useChampBrouillon('nom', tiers?.nom ?? '');
  const [telephone, setTelephone] = useChampBrouillon('telephone', tiers?.telephone ?? '');
  const [adresse, setAdresse] = useChampBrouillon('adresse', tiers?.adresse ?? '');
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    void executer(() => onEnregistrer({ nom: nom.trim(), telephone: texteFacultatif(telephone), adresse: texteFacultatif(adresse) }));
  }

  const generale = erreurGenerale(CHAMPS);
  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <ChampFormulaire libelle="Nom" required maxLength={150} value={nom} onChange={(evenement) => setNom(evenement.target.value)} erreur={erreurChamp('nom')} />
      <div className="grille-champs">
        <ChampFormulaire
          libelle="Téléphone"
          type="tel"
          maxLength={30}
          value={telephone}
          onChange={(evenement) => setTelephone(evenement.target.value)}
          erreur={erreurChamp('telephone')}
          aide="Facultatif."
        />
        <ChampFormulaire libelle="Adresse" maxLength={300} value={adresse} onChange={(evenement) => setAdresse(evenement.target.value)} erreur={erreurChamp('adresse')} aide="Facultative." />
      </div>
      <div className="formulaire__actions">
        {onAnnuler ? (
          <button type="button" className="bouton bouton--secondaire" onClick={onAnnuler} disabled={envoi}>
            Annuler
          </button>
        ) : (
          <Link to={retour} className="bouton bouton--secondaire">Annuler</Link>
        )}
        <button type="submit" className="bouton" disabled={envoi || !nom.trim()}>
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
