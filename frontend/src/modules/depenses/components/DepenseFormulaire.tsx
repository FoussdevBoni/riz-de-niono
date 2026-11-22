import { useChampBrouillon } from '../../../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../components/Alerte';
import { ChampFormulaire } from '../../../components/ChampFormulaire';
import { ChampSelection } from '../../../components/ChampSelection';
import { useEnvoiFormulaire } from '../../../hooks/useEnvoiFormulaire';
import { dateVersSaisie, decimalSaisi, decimalVersSaisie } from '../../../utils/saisie';
import type { Materiel } from '../../materiels/types/materielTypes';
import { ChampsCampagneSite } from '../../production/campagnes-agricoles/components/ChampsCampagneSite';
import type { CampagneAgricole } from '../../production/campagnes-agricoles/types/campagneAgricoleTypes';
import type { SiteProduction } from '../../production/sites-production/types/siteProductionTypes';
import type { Activite } from '../../profil/types/profilTypes';
import type { UniteTransformation } from '../../transformation/unites-transformation/types/uniteTransformationTypes';
import type { TypeDepense } from '../../types-depenses/types/typeDepenseTypes';
import type { Depense, DonneesDepense } from '../types/depenseTypes';

const CHAMPS = ['activite', 'type_depense_id', 'date_depense', 'montant', 'libelle', 'site_id', 'campagne_id', 'unite_transformation_id', 'materiel_id'] as const;

/**
 * Saisie d'une dépense dans l'activité de l'espace ouvert. Production : site et campagne obligatoires
 * (campagne non clôturée, site associé) ; transformation : unité facultative ; matériel facultatif
 * (actif et utilisé par l'activité). Le justificatif se joint depuis la fiche.
 */
export function DepenseFormulaire({
  depense,
  activite,
  types,
  materiels,
  campagnes,
  sites,
  unites,
  retour,
  onEnregistrer,
}: {
  depense?: Depense;
  activite: Activite;
  types: TypeDepense[];
  materiels: Materiel[];
  campagnes: CampagneAgricole[];
  sites: SiteProduction[];
  unites: UniteTransformation[];
  retour: string;
  onEnregistrer: (donnees: DonneesDepense) => Promise<void>;
}) {
  const [typeId, setTypeId] = useChampBrouillon('typeId', depense?.type_depense_id ?? '');
  const [date, setDate] = useChampBrouillon('date', dateVersSaisie(depense?.date_depense) || new Date().toISOString().slice(0, 10));
  const [montant, setMontant] = useChampBrouillon('montant', decimalVersSaisie(depense?.montant));
  const [libelle, setLibelle] = useChampBrouillon('libelle', depense?.libelle ?? '');
  const [rattachement, setRattachement] = useChampBrouillon('rattachement', { campagneId: depense?.campagne_id ?? '', siteId: depense?.site_id ?? '' });
  const [uniteId, setUniteId] = useChampBrouillon('uniteId', depense?.unite_transformation_id ?? '');
  const [materielId, setMaterielId] = useChampBrouillon('materielId', depense?.materiel_id ?? '');
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();

  const optionsTypes = types.filter((type) => type.actif || type._id === typeId).map((type) => ({ valeur: type._id, libelle: type.nom }));
  const optionsMateriels = materiels
    .filter((materiel) => (materiel.actif && materiel.activites.includes(activite)) || materiel._id === materielId)
    .map((materiel) => ({ valeur: materiel._id, libelle: materiel.nom }));
  const optionsUnites = unites.filter((unite) => unite.actif || unite._id === uniteId).map((unite) => ({ valeur: unite._id, libelle: unite.nom }));

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    void executer(() =>
      onEnregistrer({
        activite,
        type_depense_id: typeId,
        date_depense: date,
        montant: decimalSaisi(montant) ?? '',
        libelle: libelle.trim(),
        ...(activite === 'production' ? { site_id: rattachement.siteId || null, campagne_id: rattachement.campagneId || null } : {}),
        ...(activite === 'transformation' ? { unite_transformation_id: uniteId || null } : {}),
        materiel_id: materielId || null,
      }),
    );
  }

  const generale = erreurGenerale(CHAMPS);
  const complet = Boolean(typeId && date && montant.trim() && libelle.trim() && (activite !== 'production' || (rattachement.siteId && rattachement.campagneId)));
  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <ChampFormulaire libelle="Libellé" required maxLength={200} value={libelle} onChange={(evenement) => setLibelle(evenement.target.value)} erreur={erreurChamp('libelle')} />
      <div className="grille-champs">
        <ChampSelection libelle="Type de dépense" required options={optionsTypes} value={typeId} onChange={(evenement) => setTypeId(evenement.target.value)} erreur={erreurChamp('type_depense_id')} />
        <ChampFormulaire libelle="Montant (FCFA)" inputMode="decimal" required value={montant} onChange={(evenement) => setMontant(evenement.target.value)} erreur={erreurChamp('montant')} />
        <ChampFormulaire libelle="Date" type="date" required value={date} onChange={(evenement) => setDate(evenement.target.value)} erreur={erreurChamp('date_depense')} />
      </div>
      {activite === 'production' && (
        <ChampsCampagneSite
          campagnes={campagnes}
          sites={sites}
          campagneId={rattachement.campagneId}
          siteId={rattachement.siteId}
          onChange={setRattachement}
          erreurCampagne={erreurChamp('campagne_id')}
          erreurSite={erreurChamp('site_id')}
        />
      )}
      <div className="grille-champs">
        {activite === 'transformation' && (
          <ChampSelection
            libelle="Unité de transformation"
            libelleVide="Aucune unité"
            options={optionsUnites}
            value={uniteId}
            onChange={(evenement) => setUniteId(evenement.target.value)}
            erreur={erreurChamp('unite_transformation_id')}
          />
        )}
        <ChampSelection
          libelle="Matériel concerné"
          libelleVide="Aucun matériel"
          options={optionsMateriels}
          value={materielId}
          onChange={(evenement) => setMaterielId(evenement.target.value)}
          erreur={erreurChamp('materiel_id')}
          aide="Facultatif : par exemple pour l’entretien d’un équipement."
        />
      </div>
      <div className="formulaire__actions">
        <Link to={retour} className="bouton bouton--secondaire">
          Annuler
        </Link>
        <button type="submit" className="bouton" disabled={envoi || !complet}>
          {envoi ? 'Enregistrement…' : 'Enregistrer le brouillon'}
        </button>
      </div>
    </form>
  );
}
