import { ChampCode } from '../ChampCode';
import { useCodePropose, type ProposerCode } from '../../hooks/useCodePropose';
import { useChampBrouillon } from '../../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { useEnvoiFormulaire } from '../../hooks/useEnvoiFormulaire';
import { Alerte } from '../Alerte';
import { ChampFormulaire } from '../ChampFormulaire';

export interface ElementCodeNom {
  _id: string;
  code: string;
  nom: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

const CHAMPS = ['code', 'nom'] as const;

/**
 * Formulaire d'un référentiel simple (code et nom) : catégories de produits, types d'opérations agricoles.
 * La saisie reste en place si l'API refuse ; l'erreur s'affiche sous le champ concerné.
 */
export function ReferentielFormulaire({
  element,
  aideCode,
  proposerCode,
  codeVerrouille = false,
  retour,
  onAnnuler,
  onEnregistrer,
}: {
  element?: ElementCodeNom;
  aideCode?: string;
  /** Service du module qui propose un code à partir du nom (création). */
  proposerCode?: ProposerCode;
  /** Code non modifiable (élément de référence protégé par l'API). */
  codeVerrouille?: boolean;
  retour: string;
  onAnnuler?: () => void;
  onEnregistrer: (donnees: { code?: string; nom: string }) => Promise<void>;
}) {
  const [code, setCode] = useChampBrouillon('code', element?.code ?? '');
  const [nom, setNom] = useChampBrouillon('nom', element?.nom ?? '');
  const [codeAuto, setCodeAuto] = useChampBrouillon('codeAuto', !element);
  const proposition = useCodePropose(proposerCode, nom, codeAuto);
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    void executer(() => onEnregistrer(codeVerrouille ? { nom: nom.trim() } : { code: codeAuto ? undefined : code.trim(), nom: nom.trim() }));
  }

  const generale = erreurGenerale(CHAMPS);
  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <div className="grille-champs">
        <ChampFormulaire libelle="Nom" required maxLength={120} value={nom} onChange={(evenement) => setNom(evenement.target.value)} erreur={erreurChamp('nom')} />
        <ChampCode
          valeur={code}
          auto={codeAuto}
          proposition={proposition.code}
          recherche={proposition.recherche}
          onChange={setCode}
          onAuto={setCodeAuto}
          erreur={erreurChamp('code')}
          disabled={codeVerrouille}
          aide={codeVerrouille ? 'Code de référence : non modifiable.' : aideCode}
        />
      </div>
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
