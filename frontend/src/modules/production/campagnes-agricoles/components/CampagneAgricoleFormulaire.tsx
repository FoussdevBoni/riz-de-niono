import { ChampCode } from '../../../../components/ChampCode';
import { useCodePropose } from '../../../../hooks/useCodePropose';
import { campagneAgricoleService } from '../services/campagneAgricoleService';
import { useChampBrouillon } from '../../../../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../../components/Alerte';
import { ChampCases } from '../../../../components/ChampCases';
import { ChampFormulaire } from '../../../../components/ChampFormulaire';
import { useEnvoiFormulaire } from '../../../../hooks/useEnvoiFormulaire';
import { dateVersSaisie } from '../../../../utils/saisie';
import type { SiteProduction } from '../../sites-production/types/siteProductionTypes';
import type { CampagneAgricole, DonneesCampagneAgricole } from '../types/campagneAgricoleTypes';

const CHAMPS = ['code', 'nom', 'date_debut', 'date_fin', 'site_ids'] as const;

/**
 * Formulaire commun à la création et à la modification d'une campagne.
 * Campagne ouverte : code et date de début figés, sites déjà associés non retirables (document 04).
 */
export function CampagneAgricoleFormulaire({
  campagne,
  sites,
  retour,
  onAnnuler,
  onEnregistrer,
}: {
  campagne?: CampagneAgricole;
  sites: SiteProduction[];
  retour: string;
  onAnnuler?: () => void;
  onEnregistrer: (donnees: DonneesCampagneAgricole) => Promise<void>;
}) {
  const ouverte = campagne?.statut === 'ouverte';
  const [code, setCode] = useChampBrouillon('code', campagne?.code ?? '');
  const [nom, setNom] = useChampBrouillon('nom', campagne?.nom ?? '');
  const [codeAuto, setCodeAuto] = useChampBrouillon('codeAuto', !campagne);
  const proposition = useCodePropose(campagneAgricoleService.proposerCode, nom, codeAuto);
  const [dateDebut, setDateDebut] = useChampBrouillon('dateDebut', dateVersSaisie(campagne?.date_debut));
  const [dateFin, setDateFin] = useChampBrouillon('dateFin', dateVersSaisie(campagne?.date_fin));
  const [siteIds, setSiteIds] = useChampBrouillon<string[]>('siteIds', campagne?.site_ids ?? []);
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();

  // Sites actifs proposables, plus les sites déjà associés même archivés.
  const options = sites
    .filter((site) => site.actif || siteIds.includes(site._id))
    .map((site) => ({ valeur: site._id, libelle: site.actif ? `${site.nom} (${site.code})` : `${site.nom} (archivé)` }));
  for (const id of siteIds) {
    if (!options.some((option) => option.valeur === id)) options.push({ valeur: id, libelle: 'Nom du site indisponible' });
  }

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    const donnees: DonneesCampagneAgricole = ouverte
      ? { nom: nom.trim(), date_fin: dateFin, site_ids: siteIds }
      : { code: codeAuto ? undefined : code.trim(), nom: nom.trim(), date_debut: dateDebut, date_fin: dateFin, site_ids: siteIds };
    void executer(() => onEnregistrer(donnees));
  }

  const generale = erreurGenerale(CHAMPS);
  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      {ouverte && <Alerte ton="information">Campagne ouverte : le code et la date de début sont figés, et les sites associés ne peuvent plus être retirés.</Alerte>}
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
          disabled={ouverte}
        />
      </div>
      <div className="grille-champs">
        <ChampFormulaire
          libelle="Date de début"
          type="date"
          required
          value={dateDebut}
          disabled={ouverte}
          onChange={(evenement) => setDateDebut(evenement.target.value)}
          erreur={erreurChamp('date_debut')}
        />
        <ChampFormulaire
          libelle="Date de fin"
          type="date"
          required
          value={dateFin}
          min={dateDebut || undefined}
          onChange={(evenement) => setDateFin(evenement.target.value)}
          erreur={erreurChamp('date_fin')}
        />
      </div>
      <ChampCases
        libelle="Sites associés"
        options={options}
        valeurs={siteIds}
        verrouillees={ouverte ? campagne.site_ids : []}
        onChange={setSiteIds}
        erreur={erreurChamp('site_ids')}
        aide="L’ouverture exige au moins un site actif."
      />
      <div className="formulaire__actions">
        {onAnnuler ? (
          <button type="button" className="bouton bouton--secondaire" onClick={onAnnuler} disabled={envoi}>
            Annuler
          </button>
        ) : (
          <Link to={retour} className="bouton bouton--secondaire">Annuler</Link>
        )}
        <button type="submit" className="bouton" disabled={envoi || (!codeAuto && !code.trim()) || !nom.trim() || !dateDebut || !dateFin}>
          {envoi ? 'Enregistrement…' : campagne ? 'Enregistrer' : 'Créer la campagne'}
        </button>
      </div>
    </form>
  );
}
