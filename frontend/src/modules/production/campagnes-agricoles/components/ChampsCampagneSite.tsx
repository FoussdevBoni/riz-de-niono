import { useEffect } from 'react';

import { ChampSelection } from '../../../../components/ChampSelection';
import type { SiteProduction } from '../../sites-production/types/siteProductionTypes';
import type { CampagneAgricole } from '../types/campagneAgricoleTypes';

/**
 * Choix d'une campagne non clôturée puis d'un site associé à cette campagne, parmi les campagnes et sites
 * accessibles à l'utilisateur (l'API applique le périmètre aux listes). Changer de campagne retire un site
 * qui ne lui appartient pas.
 */
export function ChampsCampagneSite({
  campagnes,
  sites,
  campagneId,
  siteId,
  onChange,
  erreurCampagne,
  erreurSite,
  aideCampagneBrouillon,
}: {
  campagnes: CampagneAgricole[];
  sites: SiteProduction[];
  campagneId: string;
  siteId: string;
  onChange: (valeurs: { campagneId: string; siteId: string }) => void;
  erreurCampagne?: string | null;
  erreurSite?: string | null;
  aideCampagneBrouillon?: string;
}) {
  const campagne = campagnes.find((element) => element._id === campagneId);
  const optionsCampagnes = campagnes
    .filter((element) => element.statut !== 'cloturee' || element._id === campagneId)
    .map((element) => ({ valeur: element._id, libelle: `${element.nom} (${element.code})${element.statut === 'brouillon' ? ' · brouillon' : ''}` }));
  const optionsSites = sites
    .filter((site) => campagne?.site_ids.includes(site._id) && (site.actif || site._id === siteId))
    .map((site) => ({ valeur: site._id, libelle: site.nom }));

  // Contexte déjà connu : une seule campagne ouverte (et un seul site possible) est proposée d'office.
  const ouvertes = campagnes.filter((element) => element.statut === 'ouverte');
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const enCours = ouvertes.filter((element) => element.date_debut.slice(0, 10) <= aujourdhui && element.date_fin.slice(0, 10) >= aujourdhui);
  // Une seule campagne ouverte, ou une seule dont la période couvre la date du jour ; sinon le choix reste à l'utilisateur.
  const uniqueOuverte = ouvertes.length === 1 ? ouvertes[0] : enCours.length === 1 ? enCours[0] : undefined;
  const siteUnique = optionsSites.length === 1 ? optionsSites[0]!.valeur : '';

  useEffect(() => {
    if (!campagneId && uniqueOuverte) {
      const sitesPossibles = sites.filter((site) => uniqueOuverte.site_ids.includes(site._id) && site.actif);
      onChange({ campagneId: uniqueOuverte._id, siteId: sitesPossibles.length === 1 ? sitesPossibles[0]!._id : '' });
    } else if (campagneId && !siteId && siteUnique) {
      onChange({ campagneId, siteId: siteUnique });
    }
    // onChange est recréé à chaque rendu par le formulaire parent : seules les données comptent ici.
  }, [campagneId, siteId, uniqueOuverte?._id, siteUnique, sites.length]);

  function choisirCampagne(id: string) {
    const nouvelle = campagnes.find((element) => element._id === id);
    onChange({ campagneId: id, siteId: siteId && nouvelle?.site_ids.includes(siteId) ? siteId : '' });
  }

  return (
    <div className="grille-champs">
      <ChampSelection
        libelle="Campagne"
        required
        options={optionsCampagnes}
        value={campagneId}
        onChange={(evenement) => choisirCampagne(evenement.target.value)}
        erreur={erreurCampagne}
        aide={campagne?.statut === 'brouillon' ? aideCampagneBrouillon : uniqueOuverte && campagneId === uniqueOuverte._id ? (ouvertes.length === 1 ? 'Seule campagne ouverte : sélectionnée d’office.' : 'Campagne en cours à la date du jour : sélectionnée d’office.') : undefined}
      />
      <ChampSelection
        libelle="Site"
        required
        options={optionsSites}
        value={siteId}
        disabled={!campagne}
        libelleVide={campagne ? 'Choisir…' : 'Choisir d’abord une campagne'}
        onChange={(evenement) => onChange({ campagneId, siteId: evenement.target.value })}
        erreur={erreurSite}
        aide={campagne && optionsSites.length === 0 ? 'Aucun site de votre périmètre n’est associé à cette campagne.' : undefined}
      />
    </div>
  );
}
