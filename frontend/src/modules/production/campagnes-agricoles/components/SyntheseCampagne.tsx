import { CalendarRange, Gauge, Receipt, Tractor, Wheat } from 'lucide-react';

import { CarteIndicateur } from '../../../../components/CarteIndicateur';
import { GraphiqueBarres } from '../../../../components/graphiques/GraphiqueBarres';
import { JaugeProgression } from '../../../../components/graphiques/JaugeProgression';
import { formaterDate, formaterMontantCompact, formaterNombre, formaterQuantiteLisible } from '../../../../utils/formatage';
import { useTableauDeBordProduction } from '../../tableau-de-bord/hooks/useTableauDeBordProduction';
import type { SiteProduction } from '../../sites-production/types/siteProductionTypes';
import type { CampagneAgricole } from '../types/campagneAgricoleTypes';

const JOUR = 86_400_000;

/** Avancement calendaire de la campagne (jours écoulés sur la durée prévue). */
function avancement(campagne: CampagneAgricole) {
  const debut = new Date(campagne.date_debut).getTime();
  const fin = new Date(campagne.date_fin).getTime();
  const duree = Math.max(1, Math.round((fin - debut) / JOUR) + 1);
  const ecoules = Math.min(duree, Math.max(0, Math.round((Date.now() - debut) / JOUR) + 1));
  return { duree, ecoules, restants: duree - ecoules };
}

/**
 * Synthèse de pilotage d'une campagne : période, récolte, rendement, travaux et dépenses,
 * puis récolte par site. Les chiffres viennent du tableau de bord de production filtré sur la campagne.
 */
export function SyntheseCampagne({
  campagne,
  sites,
  avecIndicateurs,
}: {
  campagne: CampagneAgricole;
  sites: SiteProduction[];
  /** Faux si l'utilisateur n'a pas accès au tableau de bord : seule la période est affichée. */
  avecIndicateurs: boolean;
}) {
  const periode = avancement(campagne);
  const requete = useTableauDeBordProduction(avecIndicateurs ? { campagne_id: campagne._id } : { campagne_id: '' });
  const tableau = avecIndicateurs ? requete.donnees : null;
  const principale = tableau ? [...tableau.recoltes].sort((a, b) => Number(b.quantite) - Number(a.quantite))[0] : undefined;
  const nomSite = (id: string) => sites.find((site) => site._id === id)?.nom ?? 'Site hors de votre périmètre';

  return (
    <>
      <div className="grille-indicateurs">
        <CarteIndicateur
          libelle="Période"
          icone={CalendarRange}
          valeur={campagne.statut === 'cloturee' ? 'Clôturée' : periode.restants > 0 ? `J-${periode.restants}` : 'Échéance passée'}
          precision={`${formaterDate(campagne.date_debut)} – ${formaterDate(campagne.date_fin)}`}
        >
          <JaugeProgression valeur={periode.ecoules} total={periode.duree} libelle="Avancement de la période de campagne" ton="attention" />
        </CarteIndicateur>
        {tableau && (
          <>
            <CarteIndicateur
              libelle="Récolte validée"
              icone={Wheat}
              ton="accent"
              valeur={principale ? formaterQuantiteLisible(principale.quantite, principale.unite_stock) : '—'}
              precision={principale?.produit_nom ?? 'Aucune récolte validée'}
            />
            <CarteIndicateur
              libelle="Rendement"
              icone={Gauge}
              valeur={principale?.rendement_kg_ha ? `${formaterNombre(principale.rendement_kg_ha, 0)} kg/ha` : '—'}
              precision={`${formaterNombre(tableau.superficie_recoltee_ha)} ha récoltés sur ${formaterNombre(tableau.superficie_cultivee_ha)} ha`}
            />
            <CarteIndicateur
              libelle="Travaux"
              icone={Tractor}
              valeur={`${tableau.travaux.realises} réalisé${tableau.travaux.realises > 1 ? 's' : ''}`}
              precision={`${tableau.travaux.planifies} planifié${tableau.travaux.planifies > 1 ? 's' : ''}`}
            />
            <CarteIndicateur libelle="Dépenses validées" icone={Receipt} valeur={formaterMontantCompact(tableau.depenses_enregistrees)} precision="Rattachées à la campagne" />
          </>
        )}
      </div>
      {tableau && tableau.par_site.length > 0 && (
        <section className="panneau" aria-labelledby="titre-sites-campagne">
          <div className="panneau__entete">
            <div>
              <h2 id="titre-sites-campagne" className="panneau__titre">Récolte par site</h2>
              <p className="panneau__sous-titre">Quantité validée, rendement et dépenses de chaque site de la campagne</p>
            </div>
          </div>
          <GraphiqueBarres
            titre="Récolte par site de la campagne"
            barres={tableau.par_site.map((site) => {
              const recolte = site.recoltes[0];
              return {
                cle: site.site_id,
                libelle: nomSite(site.site_id),
                detail: `${recolte?.rendement_kg_ha ? `${formaterNombre(recolte.rendement_kg_ha, 0)} kg/ha · ` : ''}${formaterMontantCompact(site.depenses_enregistrees)} de dépenses`,
                valeur: Number(recolte?.quantite ?? 0),
                texte: recolte ? formaterQuantiteLisible(recolte.quantite, recolte.unite_stock) : 'Pas de récolte',
              };
            })}
          />
        </section>
      )}
    </>
  );
}
