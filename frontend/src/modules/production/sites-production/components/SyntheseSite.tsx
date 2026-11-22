import { Gauge, LandPlot, Receipt, Tractor, Wheat } from 'lucide-react';

import { CarteIndicateur } from '../../../../components/CarteIndicateur';
import { JaugeProgression } from '../../../../components/graphiques/JaugeProgression';
import { formaterMontantCompact, formaterNombre, formaterQuantiteLisible } from '../../../../utils/formatage';
import { useTableauDeBordProduction } from '../../tableau-de-bord/hooks/useTableauDeBordProduction';

/**
 * Synthèse d'un site toutes campagnes confondues : superficie exploitée, récolte, rendement,
 * travaux et dépenses (tableau de bord de production filtré sur le site).
 */
export function SyntheseSite({ siteId, superficieSite }: { siteId: string; superficieSite: string | null }) {
  const { donnees: tableau } = useTableauDeBordProduction({ site_id: siteId });
  if (!tableau) return null;

  const principale = [...tableau.recoltes].sort((a, b) => Number(b.quantite) - Number(a.quantite))[0];
  const superficie = Number(superficieSite ?? 0);
  const cultivee = Number(tableau.superficie_cultivee_ha);

  return (
    <div className="grille-indicateurs">
      <CarteIndicateur
        libelle="Superficie cultivée"
        icone={LandPlot}
        valeur={`${formaterNombre(cultivee)} ha`}
        precision={superficie > 0 ? `sur ${formaterNombre(superficie)} ha aménagés` : 'Superficie du site non renseignée'}
      >
        {superficie > 0 && <JaugeProgression valeur={cultivee} total={superficie} libelle="Part de la superficie du site mise en culture" />}
      </CarteIndicateur>
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
        precision={`${formaterNombre(tableau.superficie_recoltee_ha)} ha récoltés`}
      />
      <CarteIndicateur
        libelle="Travaux"
        icone={Tractor}
        valeur={`${tableau.travaux.realises} réalisé${tableau.travaux.realises > 1 ? 's' : ''}`}
        precision={`${tableau.travaux.planifies} planifié${tableau.travaux.planifies > 1 ? 's' : ''}`}
      />
      <CarteIndicateur libelle="Dépenses validées" icone={Receipt} valeur={formaterMontantCompact(tableau.depenses_enregistrees)} precision="Toutes campagnes confondues" />
    </div>
  );
}
