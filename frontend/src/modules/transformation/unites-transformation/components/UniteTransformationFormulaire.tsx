import { ChampCode } from '../../../../components/ChampCode';
import { useCodePropose } from '../../../../hooks/useCodePropose';
import { uniteTransformationService } from '../services/uniteTransformationService';
import { useChampBrouillon } from '../../../../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../../components/Alerte';
import { ChampFormulaire } from '../../../../components/ChampFormulaire';
import { useEnvoiFormulaire } from '../../../../hooks/useEnvoiFormulaire';
import { texteFacultatif } from '../../../../utils/saisie';
import type { DonneesUniteTransformation, UniteTransformation } from '../types/uniteTransformationTypes';

const CHAMPS = ['code', 'nom', 'localisation'] as const;

/** Formulaire d'une unité de transformation : code, nom et localisation facultative. */
export function UniteTransformationFormulaire({
  unite,
  retour,
  onAnnuler,
  onEnregistrer,
}: {
  unite?: UniteTransformation;
  retour: string;
  onAnnuler?: () => void;
  onEnregistrer: (donnees: DonneesUniteTransformation) => Promise<void>;
}) {
  const [code, setCode] = useChampBrouillon('code', unite?.code ?? '');
  const [nom, setNom] = useChampBrouillon('nom', unite?.nom ?? '');
  const [codeAuto, setCodeAuto] = useChampBrouillon('codeAuto', !unite);
  const proposition = useCodePropose(uniteTransformationService.proposerCode, nom, codeAuto);
  const [localisation, setLocalisation] = useChampBrouillon('localisation', unite?.localisation ?? '');
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    void executer(() => onEnregistrer({ code: codeAuto ? undefined : code.trim(), nom: nom.trim(), localisation: texteFacultatif(localisation) }));
  }

  const generale = erreurGenerale(CHAMPS);
  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <div className="grille-champs">
        <ChampFormulaire libelle="Nom" required maxLength={100} value={nom} onChange={(evenement) => setNom(evenement.target.value)} erreur={erreurChamp('nom')} />
        <ChampCode
          valeur={code}
          auto={codeAuto}
          proposition={proposition.code}
          recherche={proposition.recherche}
          onChange={setCode}
          onAuto={setCodeAuto}
          erreur={erreurChamp('code')}
        />
      </div>
      <ChampFormulaire
        libelle="Localisation"
        maxLength={200}
        value={localisation}
        onChange={(evenement) => setLocalisation(evenement.target.value)}
        erreur={erreurChamp('localisation')}
        aide="Facultative."
      />
      <div className="formulaire__actions">
        {onAnnuler ? (
          <button type="button" className="bouton bouton--secondaire" onClick={onAnnuler} disabled={envoi}>
            Annuler
          </button>
        ) : (
          <Link to={retour} className="bouton bouton--secondaire">Annuler</Link>
        )}
        <button type="submit" className="bouton" disabled={envoi || (!codeAuto && !code.trim()) || !nom.trim()}>
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
