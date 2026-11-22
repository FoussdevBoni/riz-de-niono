import { useChampBrouillon } from '../../../../hooks/useChampBrouillon';
import { useId, type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../../components/Alerte';
import { ChampFormulaire } from '../../../../components/ChampFormulaire';
import { useEnvoiFormulaire } from '../../../../hooks/useEnvoiFormulaire';
import type { DonneesEquipeProduction, EquipeProduction } from '../types/equipeProductionTypes';

const CHAMPS = ['nom', 'membres'] as const;

/** Formulaire d'une équipe : nom et membres (un nom par ligne). */
export function EquipeProductionFormulaire({
  equipe,
  retour,
  onEnregistrer,
}: {
  equipe?: EquipeProduction;
  retour: string;
  onEnregistrer: (donnees: DonneesEquipeProduction) => Promise<void>;
}) {
  const idMembres = useId();
  const [nom, setNom] = useChampBrouillon('nom', equipe?.nom ?? '');
  const [membres, setMembres] = useChampBrouillon('membres', (equipe?.membres ?? []).join('\n'));
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();
  const listeMembres = membres
    .split('\n')
    .map((membre) => membre.trim())
    .filter(Boolean);

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    void executer(() => onEnregistrer({ nom: nom.trim(), membres: listeMembres }));
  }

  const generale = erreurGenerale(CHAMPS);
  const erreurMembres = erreurChamp('membres');
  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <ChampFormulaire libelle="Nom de l’équipe" required maxLength={120} value={nom} onChange={(evenement) => setNom(evenement.target.value)} erreur={erreurChamp('nom')} />
      <div className="champ">
        <label htmlFor={idMembres} className="champ__libelle">
          Membres
        </label>
        <textarea
          id={idMembres}
          className={`champ__saisie${erreurMembres ? ' champ__saisie--erreur' : ''}`}
          rows={6}
          value={membres}
          onChange={(evenement) => setMembres(evenement.target.value)}
          aria-describedby={`${idMembres}-aide`}
          aria-invalid={Boolean(erreurMembres)}
        />
        <p id={`${idMembres}-aide`} className={erreurMembres ? 'champ__erreur' : 'champ__aide'}>
          {erreurMembres ?? `Un membre par ligne · ${listeMembres.length} membre${listeMembres.length > 1 ? 's' : ''}.`}
        </p>
      </div>
      <div className="formulaire__actions">
        <Link to={retour} className="bouton bouton--secondaire">
          Annuler
        </Link>
        <button type="submit" className="bouton" disabled={envoi || !nom.trim()}>
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
