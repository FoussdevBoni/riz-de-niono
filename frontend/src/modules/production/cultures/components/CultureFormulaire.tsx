import { useChampBrouillon } from '../../../../hooks/useChampBrouillon';
import { type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../../components/Alerte';
import { ChampFormulaire } from '../../../../components/ChampFormulaire';
import { useEnvoiFormulaire } from '../../../../hooks/useEnvoiFormulaire';
import { dateVersSaisie, decimalSaisi, decimalVersSaisie, texteFacultatif } from '../../../../utils/saisie';
import { ChampsCampagneSite } from '../../campagnes-agricoles/components/ChampsCampagneSite';
import type { CampagneAgricole } from '../../campagnes-agricoles/types/campagneAgricoleTypes';
import type { SiteProduction } from '../../sites-production/types/siteProductionTypes';
import type { Culture, DonneesCulture } from '../types/cultureTypes';

const CHAMPS = ['campagne_id', 'site_id', 'culture', 'variete', 'superficie_ha', 'date_semis'] as const;

/** Saisie d'une culture : campagne et site accessibles, culture, variété, superficie et date de semis. */
export function CultureFormulaire({
  culture,
  campagnes,
  sites,
  campagneInitiale,
  retour,
  onEnregistrer,
}: {
  culture?: Culture;
  campagnes: CampagneAgricole[];
  sites: SiteProduction[];
  campagneInitiale?: string;
  retour: string;
  onEnregistrer: (donnees: DonneesCulture) => Promise<void>;
}) {
  const [rattachement, setRattachement] = useChampBrouillon('rattachement', { campagneId: culture?.campagne_id ?? campagneInitiale ?? '', siteId: culture?.site_id ?? '' });
  const [nomCulture, setNomCulture] = useChampBrouillon('nomCulture', culture?.culture ?? '');
  const [variete, setVariete] = useChampBrouillon('variete', culture?.variete ?? '');
  const [superficie, setSuperficie] = useChampBrouillon('superficie', decimalVersSaisie(culture?.superficie_ha));
  const [dateSemis, setDateSemis] = useChampBrouillon('dateSemis', dateVersSaisie(culture?.date_semis));
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    void executer(() =>
      onEnregistrer({
        campagne_id: rattachement.campagneId,
        site_id: rattachement.siteId,
        culture: nomCulture.trim(),
        variete: texteFacultatif(variete),
        superficie_ha: decimalSaisi(superficie) ?? '',
        date_semis: dateSemis || null,
      }),
    );
  }

  const generale = erreurGenerale(CHAMPS);
  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      <ChampsCampagneSite
        campagnes={campagnes}
        sites={sites}
        campagneId={rattachement.campagneId}
        siteId={rattachement.siteId}
        onChange={setRattachement}
        erreurCampagne={erreurChamp('campagne_id')}
        erreurSite={erreurChamp('site_id')}
      />
      <div className="grille-champs">
        <ChampFormulaire
          libelle="Culture"
          required
          maxLength={80}
          value={nomCulture}
          onChange={(evenement) => setNomCulture(evenement.target.value)}
          erreur={erreurChamp('culture')}
          aide="Par exemple Riz."
        />
        <ChampFormulaire libelle="Variété" maxLength={80} value={variete} onChange={(evenement) => setVariete(evenement.target.value)} erreur={erreurChamp('variete')} aide="Facultative." />
      </div>
      <div className="grille-champs">
        <ChampFormulaire
          libelle="Superficie cultivée (ha)"
          inputMode="decimal"
          required
          value={superficie}
          onChange={(evenement) => setSuperficie(evenement.target.value)}
          erreur={erreurChamp('superficie_ha')}
        />
        <ChampFormulaire libelle="Date de semis" type="date" value={dateSemis} onChange={(evenement) => setDateSemis(evenement.target.value)} erreur={erreurChamp('date_semis')} aide="Facultative." />
      </div>
      <div className="formulaire__actions">
        <Link to={retour} className="bouton bouton--secondaire">
          Annuler
        </Link>
        <button type="submit" className="bouton" disabled={envoi || !rattachement.campagneId || !rattachement.siteId || !nomCulture.trim() || !superficie.trim()}>
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
