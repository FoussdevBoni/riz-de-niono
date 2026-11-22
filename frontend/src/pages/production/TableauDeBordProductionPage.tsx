import { Gauge, LandPlot, Receipt, Sprout, Tractor, Wheat } from 'lucide-react';

import { BarreProportion } from '../../components/BarreProportion';
import { GraphiqueAnneau } from '../../components/graphiques/GraphiqueAnneau';
import { GraphiqueBarres } from '../../components/graphiques/GraphiqueBarres';
import { JaugeProgression } from '../../components/graphiques/JaugeProgression';
import { BlocRequete } from '../../components/BlocRequete';
import { CarteIndicateur } from '../../components/CarteIndicateur';
import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';
import { SelectFiltre } from '../../components/SelectFiltre';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { libelleReference } from '../../hooks/useOptionsReference';
import { useSession } from '../../modules/authentification/hooks/useSession';
import {
  useOptionsTableauProduction,
  useTableauDeBordProduction,
} from '../../modules/production/tableau-de-bord/hooks/useTableauDeBordProduction';
import type { TableauDeBordProduction } from '../../modules/production/tableau-de-bord/types/tableauDeBordProductionTypes';
import { estNul, formaterMontant, formaterMontantCompact, formaterNombre, formaterPart, formaterQuantite, formaterQuantiteLisible } from '../../utils/formatage';

const FILTRES = ['campagne_id', 'site_id'] as const;

/** /production/tableau-de-bord : superficies, récoltes, rendements, travaux et dépenses enregistrées. */
export function TableauDeBordProductionPage() {
  const { profil } = useSession();
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const requete = useTableauDeBordProduction(filtres);
  const { campagnes, sites, produits } = useOptionsTableauProduction(profil);
  const limiteAuxSites = (profil?.site_ids.length ?? 0) > 0;

  return (
    <section>
      <EnTetePage
        titre="Tableau de bord de production"
        sousTitre={limiteAuxSites ? 'Chiffres limités aux sites qui vous sont attribués.' : 'Récoltes, rendements, avancement des travaux et dépenses validés, par campagne et par site.'}
      />
      <div className="barre-filtres" role="search" aria-label="Filtres du tableau de bord">
        {campagnes.length > 0 && (
          <SelectFiltre
            libelle="Campagne"
            libelleTous="Toutes les campagnes"
            valeur={filtres.campagne_id ?? ''}
            options={campagnes}
            onChange={(valeur) => definir('campagne_id', valeur)}
          />
        )}
        {sites.length > 0 && (
          <SelectFiltre
            libelle="Site"
            libelleTous={limiteAuxSites ? 'Tous mes sites' : 'Tous les sites'}
            valeur={filtres.site_id ?? ''}
            options={sites}
            onChange={(valeur) => definir('site_id', valeur)}
          />
        )}
        {(filtres.campagne_id || filtres.site_id) && (
          <button type="button" className="bouton bouton--fantome-sombre" onClick={reinitialiser}>
            Effacer les filtres
          </button>
        )}
      </div>
      <BlocRequete {...requete} cartes={5}>
        {(tableau) => <ContenuProduction tableau={tableau} produits={produits} sites={sites} />}
      </BlocRequete>
    </section>
  );
}

function ContenuProduction({
  tableau,
  produits,
  sites,
}: {
  tableau: TableauDeBordProduction;
  produits: { valeur: string; libelle: string }[];
  sites: { valeur: string; libelle: string }[];
}) {
  const vide =
    estNul(tableau.superficie_cultivee_ha, tableau.superficie_recoltee_ha, tableau.depenses_enregistrees, tableau.travaux.realises, tableau.travaux.planifies) &&
    tableau.recoltes.length === 0;
  if (vide) {
    return (
      <EtatVide titre="Aucune donnée pour ces filtres" icone={Sprout}>
        <p>Les cultures, récoltes validées, travaux et dépenses validées de la période apparaîtront ici.</p>
      </EtatVide>
    );
  }

  const principale = [...tableau.recoltes].sort((a, b) => Number(b.quantite) - Number(a.quantite))[0];
  const cultivee = Number(tableau.superficie_cultivee_ha);
  const recoltee = Number(tableau.superficie_recoltee_ha);
  const depenses = Number(tableau.depenses_enregistrees);
  const travauxTotal = tableau.travaux.realises + tableau.travaux.planifies;
  const nomSite = (id: string) => libelleReference(sites, id, 'Site hors de votre périmètre');
  const recolteSite = (site: TableauDeBordProduction['par_site'][number]) =>
    site.recoltes.find((recolte) => recolte.produit_id === principale?.produit_id) ?? site.recoltes[0];
  const rendementMax = Math.max(0, ...tableau.par_site.flatMap((site) => site.recoltes.map((recolte) => Number(recolte.rendement_kg_ha ?? 0))));
  const nomPrincipal = principale ? (principale.produit_nom ?? libelleReference(produits, principale.produit_id, 'Produit principal')) : null;

  return (
    <>
      <div className="grille-indicateurs">
        <CarteIndicateur
          libelle={tableau.recoltes.length > 1 ? 'Produit le plus récolté' : 'Récolte validée'}
          icone={Wheat}
          ton="accent"
          valeur={principale ? formaterQuantiteLisible(principale.quantite, principale.unite_stock) : '—'}
          precision={nomPrincipal ?? 'Aucune récolte validée'}
        />
        <CarteIndicateur
          libelle="Rendement moyen"
          icone={Gauge}
          valeur={principale?.rendement_kg_ha ? `${formaterNombre(principale.rendement_kg_ha, 0)} kg/ha` : '—'}
          precision={principale?.rendement_kg_ha ? `soit ${formaterNombre(Number(principale.rendement_kg_ha) / 1000, 1)} t par hectare récolté` : 'Disponible après la première récolte'}
        />
        <CarteIndicateur
          libelle="Superficie récoltée"
          icone={LandPlot}
          valeur={`${formaterNombre(recoltee)} / ${formaterNombre(cultivee)} ha`}
          precision={cultivee > 0 ? `${formaterPart(recoltee, cultivee)} de la superficie cultivée` : 'Aucune culture saisie'}
        >
          <JaugeProgression valeur={recoltee} total={cultivee} libelle="Part de la superficie récoltée" />
        </CarteIndicateur>
        <CarteIndicateur
          libelle="Travaux agricoles"
          icone={Tractor}
          valeur={`${tableau.travaux.realises} réalisé${tableau.travaux.realises > 1 ? 's' : ''}`}
          precision={tableau.travaux.planifies > 0 ? `${tableau.travaux.planifies} encore planifié${tableau.travaux.planifies > 1 ? 's' : ''}` : 'Aucun travail en attente'}
        >
          <JaugeProgression valeur={tableau.travaux.realises} total={travauxTotal} libelle="Part des travaux réalisés" />
        </CarteIndicateur>
        <CarteIndicateur
          libelle="Dépenses validées"
          icone={Receipt}
          valeur={formaterMontantCompact(depenses)}
          precision={cultivee > 0 ? `${formaterMontant(String(Math.round(depenses / cultivee)))} par hectare cultivé` : formaterMontant(tableau.depenses_enregistrees)}
        />
      </div>

      {tableau.par_site.length > 0 && (
        <div className="grille-tableau-de-bord">
          <section className="panneau" aria-labelledby="titre-recolte-sites">
            <div className="panneau__entete">
              <div>
                <h2 id="titre-recolte-sites" className="panneau__titre">Récolte par site</h2>
                <p className="panneau__sous-titre">
                  {nomPrincipal ? `${nomPrincipal} validé et rendement obtenu sur chaque site` : 'Aucune récolte validée'}
                </p>
              </div>
            </div>
            <GraphiqueBarres
              titre="Récolte par site"
              barres={tableau.par_site.map((site) => {
                const recolte = recolteSite(site);
                return {
                  cle: site.site_id,
                  libelle: nomSite(site.site_id),
                  detail: recolte?.rendement_kg_ha
                    ? `${formaterNombre(recolte.rendement_kg_ha, 0)} kg/ha · ${formaterNombre(site.superficie_recoltee_ha)} ha`
                    : `${formaterNombre(site.superficie_cultivee_ha)} ha cultivés`,
                  valeur: Number(recolte?.quantite ?? 0),
                  texte: recolte ? formaterQuantiteLisible(recolte.quantite, recolte.unite_stock) : '—',
                };
              })}
            />
          </section>
          <section className="panneau" aria-labelledby="titre-depenses-sites">
            <div className="panneau__entete">
              <div>
                <h2 id="titre-depenses-sites" className="panneau__titre">Dépenses par site</h2>
                <p className="panneau__sous-titre">Dépenses validées rattachées à chaque site</p>
              </div>
            </div>
            {depenses > 0 ? (
              <GraphiqueAnneau
                titre="Répartition des dépenses validées par site"
                centre={formaterMontantCompact(depenses)}
                sousCentre="au total"
                segments={tableau.par_site.map((site) => ({
                  cle: site.site_id,
                  libelle: nomSite(site.site_id),
                  valeur: Number(site.depenses_enregistrees),
                  texte: formaterMontantCompact(site.depenses_enregistrees),
                }))}
              />
            ) : (
              <p className="texte-doux">Aucune dépense validée pour ces filtres.</p>
            )}
          </section>
        </div>
      )}

      {tableau.recoltes.length > 1 && (
        <section className="panneau">
          <h2 className="panneau__titre">Récoltes par produit</h2>
          <div className="tableau-defilant">
            <table className="tableau">
              <thead>
                <tr>
                  <th scope="col">Produit</th>
                  <th scope="col" className="nombre">Quantité</th>
                  <th scope="col" className="nombre">Superficie récoltée</th>
                  <th scope="col" className="nombre">Rendement</th>
                </tr>
              </thead>
              <tbody>
                {tableau.recoltes.map((recolte) => (
                  <tr key={recolte.produit_id}>
                    <th scope="row">{recolte.produit_nom ?? libelleReference(produits, recolte.produit_id, 'Produit hors catalogue')}</th>
                    <td className="nombre">{formaterQuantite(recolte.quantite, recolte.unite_stock)}</td>
                    <td className="nombre">{formaterNombre(recolte.superficie_recoltee_ha)} ha</td>
                    <td className="nombre">{recolte.rendement_kg_ha ? `${formaterNombre(recolte.rendement_kg_ha, 0)} kg/ha` : 'Indisponible'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panneau">
        <div className="panneau__entete">
          <div>
            <h2 className="panneau__titre">Comparaison des sites</h2>
            <p className="panneau__sous-titre">Superficies, récolte principale, avancement des travaux et dépenses</p>
          </div>
        </div>
        {tableau.par_site.length === 0 ? (
          <p className="texte-doux">Aucun site n’a encore de données pour ces filtres.</p>
        ) : (
          <div className="tableau-defilant">
            <table className="tableau">
              <thead>
                <tr>
                  <th scope="col">Site</th>
                  <th scope="col" className="nombre">Cultivée</th>
                  <th scope="col" className="nombre">Récoltée</th>
                  <th scope="col" className="nombre">Récolte</th>
                  <th scope="col">Rendement</th>
                  <th scope="col" className="nombre">Travaux réalisés</th>
                  <th scope="col" className="nombre">Dépenses</th>
                </tr>
              </thead>
              <tbody>
                {tableau.par_site.map((site) => {
                  const recolte = recolteSite(site);
                  return (
                    <tr key={site.site_id}>
                      <th scope="row">{nomSite(site.site_id)}</th>
                      <td className="nombre">{formaterNombre(site.superficie_cultivee_ha)} ha</td>
                      <td className="nombre">{formaterNombre(site.superficie_recoltee_ha)} ha</td>
                      <td className="nombre">{recolte ? formaterQuantiteLisible(recolte.quantite, recolte.unite_stock) : '—'}</td>
                      <td>
                        {recolte?.rendement_kg_ha ? (
                          <BarreProportion
                            valeur={Number(recolte.rendement_kg_ha)}
                            maximum={rendementMax}
                            libelle={`${formaterNombre(recolte.rendement_kg_ha, 0)} kg/ha`}
                          />
                        ) : (
                          <span className="texte-doux">—</span>
                        )}
                      </td>
                      <td className="nombre">
                        {site.travaux.realises} / {site.travaux.realises + site.travaux.planifies}
                      </td>
                      <td className="nombre">{formaterMontant(site.depenses_enregistrees)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
