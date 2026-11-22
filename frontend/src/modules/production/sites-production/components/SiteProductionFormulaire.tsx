import { ChampCode } from '../../../../components/ChampCode';
import { useCodePropose } from '../../../../hooks/useCodePropose';
import { siteProductionService } from '../services/siteProductionService';
import { useChampBrouillon } from '../../../../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../../components/Alerte';
import { ChampFormulaire } from '../../../../components/ChampFormulaire';
import { ChampSelection } from '../../../../components/ChampSelection';
import { useEnvoiFormulaire } from '../../../../hooks/useEnvoiFormulaire';
import { decimalSaisi, decimalVersSaisie, texteFacultatif } from '../../../../utils/saisie';
import type { UtilisateurResume } from '../../../utilisateurs/types/utilisateurTypes';
import type { DonneesSiteProduction, SiteProduction } from '../types/siteProductionTypes';

const CHAMPS = ['code', 'nom', 'localisation', 'superficie_ha', 'responsable_id'] as const;

/**
 * Formulaire commun à la création et à la modification d'un site.
 * En cas de refus de l'API, la saisie reste en place et l'erreur s'affiche sous le champ concerné.
 */
export function SiteProductionFormulaire({
  site,
  utilisateurs,
  retour,
  onAnnuler,
  onEnregistrer,
}: {
  site?: SiteProduction;
  utilisateurs: UtilisateurResume[];
  retour: string;
  onAnnuler?: () => void;
  onEnregistrer: (donnees: DonneesSiteProduction) => Promise<void>;
}) {
  const [code, setCode] = useChampBrouillon('code', site?.code ?? '');
  const [nom, setNom] = useChampBrouillon('nom', site?.nom ?? '');
  const [codeAuto, setCodeAuto] = useChampBrouillon('codeAuto', !site);
  const proposition = useCodePropose(siteProductionService.proposerCode, nom, codeAuto);
  const [localisation, setLocalisation] = useChampBrouillon('localisation', site?.localisation ?? '');
  const [superficie, setSuperficie] = useChampBrouillon('superficie', decimalVersSaisie(site?.superficie_ha));
  const [responsableId, setResponsableId] = useChampBrouillon('responsableId', site?.responsable_id ?? '');
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();

  const optionsResponsables = utilisateurs
    .filter((utilisateur) => utilisateur.actif || utilisateur._id === responsableId)
    .map((utilisateur) => ({ valeur: utilisateur._id, libelle: utilisateur.nom }));
  // Responsable actuel hors de la liste accessible : il reste sélectionné sous son identifiant abrégé.
  if (responsableId && !optionsResponsables.some((option) => option.valeur === responsableId)) {
    optionsResponsables.unshift({ valeur: responsableId, libelle: 'Nom du responsable actuel indisponible' });
  }

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    void executer(() =>
      onEnregistrer({
        code: codeAuto ? undefined : code.trim(),
        nom: nom.trim(),
        localisation: texteFacultatif(localisation),
        superficie_ha: decimalSaisi(superficie),
        responsable_id: responsableId || null,
      }),
    );
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
        />
      </div>
      <ChampFormulaire
        libelle="Localisation"
        maxLength={200}
        value={localisation}
        onChange={(evenement) => setLocalisation(evenement.target.value)}
        erreur={erreurChamp('localisation')}
      />
      <div className="grille-champs">
        <ChampFormulaire
          libelle="Superficie (ha)"
          inputMode="decimal"
          value={superficie}
          onChange={(evenement) => setSuperficie(evenement.target.value)}
          erreur={erreurChamp('superficie_ha')}
          aide="Facultative."
        />
        <ChampSelection
          libelle="Responsable"
          libelleVide="Aucun responsable"
          options={optionsResponsables}
          value={responsableId}
          onChange={(evenement) => setResponsableId(evenement.target.value)}
          erreur={erreurChamp('responsable_id')}
          disabled={utilisateurs.length === 0 && !responsableId}
          aide={utilisateurs.length === 0 ? 'La liste des utilisateurs n’est pas accessible avec vos droits.' : undefined}
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
