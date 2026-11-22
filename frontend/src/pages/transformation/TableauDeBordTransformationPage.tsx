import { Factory, Gauge, Package, Receipt, Wheat } from 'lucide-react';

import { BarreRepartition } from '../../components/graphiques/BarreRepartition';
import { GraphiqueBarres } from '../../components/graphiques/GraphiqueBarres';
import { JaugeProgression } from '../../components/graphiques/JaugeProgression';
import { BlocRequete } from '../../components/BlocRequete';
import { CarteIndicateur } from '../../components/CarteIndicateur';
import { ChampFormulaire } from '../../components/ChampFormulaire';
import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';
import { SelectFiltre } from '../../components/SelectFiltre';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { libelleReference } from '../../hooks/useOptionsReference';
import { useSession } from '../../modules/authentification/hooks/useSession';
import {
  useOptionsTableauTransformation,
  useTableauDeBordTransformation,
} from '../../modules/transformation/tableau-de-bord/hooks/useTableauDeBordTransformation';
import { formaterMontantCompact, formaterNombre, formaterPart, formaterQuantite, formaterQuantiteLisible } from '../../utils/formatage';

const FILTRES = ['unite_transformation_id', 'date_debut', 'date_fin'] as const;

/** /transformation/tableau-de-bord : paddy consommé, produits obtenus, rendement et dépenses directes. */
export function TableauDeBordTransformationPage() {
  const { profil } = useSession();
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const requete = useTableauDeBordTransformation(filtres);
  const { unites, produits } = useOptionsTableauTransformation(profil);

  return (
    <section>
      <EnTetePage titre="Tableau de bord de transformation" sousTitre="Paddy transformé, rendements, bilan matière et dépenses directes, par unité et période." />
      <div className="barre-filtres" role="search" aria-label="Filtres du tableau de bord">
        {unites.length > 0 && (
          <SelectFiltre
            libelle="Unité"
            libelleTous="Toutes les unités"
            valeur={filtres.unite_transformation_id ?? ''}
            options={unites}
            onChange={(valeur) => definir('unite_transformation_id', valeur)}
          />
        )}
        <div className="champ--compact">
          <ChampFormulaire libelle="Du" type="date" value={filtres.date_debut ?? ''} onChange={(e) => definir('date_debut', e.target.value)} />
        </div>
        <div className="champ--compact">
          <ChampFormulaire libelle="Au" type="date" value={filtres.date_fin ?? ''} onChange={(e) => definir('date_fin', e.target.value)} />
        </div>
        {Object.keys(filtres).length > 0 && (
          <button type="button" className="bouton bouton--fantome-sombre" onClick={reinitialiser}>
            Effacer les filtres
          </button>
        )}
      </div>
      <BlocRequete {...requete} cartes={3}>
        {(tableau) => {
          if (tableau.operations_validees === 0 && Number(tableau.depenses_directes) === 0) {
            return (
              <EtatVide titre="Aucune transformation validée pour ces filtres" icone={Factory}>
                <p>Les opérations de transformation validées et leurs dépenses directes apparaîtront ici.</p>
              </EtatVide>
            );
          }
          const paddy = tableau.paddy_consomme.reduce((total, ligne) => total + Number(ligne.quantite), 0);
          const unitePaddy = tableau.paddy_consomme[0]?.unite_stock ?? null;
          const obtenus = [...tableau.produits_obtenus].sort((a, b) => Number(b.quantite) - Number(a.quantite));
          const principal = obtenus[0];
          const memeUnite = obtenus.every((ligne) => ligne.unite_stock === unitePaddy);
          const totalObtenu = obtenus.reduce((total, ligne) => total + Number(ligne.quantite), 0);
          const ecart = memeUnite ? Math.max(0, paddy - totalObtenu) : 0;
          const depenses = Number(tableau.depenses_directes);
          const nomProduit = (ligne: (typeof obtenus)[number]) => ligne.produit_nom ?? libelleReference(produits, ligne.produit_id, 'Produit hors catalogue');
          return (
            <>
              <div className="grille-indicateurs">
                <CarteIndicateur
                  libelle="Paddy consommé"
                  icone={Wheat}
                  ton="accent"
                  valeur={formaterQuantiteLisible(paddy, unitePaddy)}
                  precision={`${tableau.operations_validees} opération${tableau.operations_validees > 1 ? 's' : ''} validée${tableau.operations_validees > 1 ? 's' : ''}`}
                />
                <CarteIndicateur
                  libelle={principal ? `Rendement en ${nomProduit(principal).toLowerCase()}` : 'Rendement'}
                  icone={Gauge}
                  valeur={principal?.rendement_pct ? `${formaterNombre(principal.rendement_pct, 1)} %` : '—'}
                  precision={principal ? `${formaterQuantiteLisible(principal.quantite, principal.unite_stock)} obtenus` : 'Aucun produit obtenu'}
                >
                  {principal?.rendement_pct && <JaugeProgression valeur={Number(principal.rendement_pct)} total={100} libelle="Rendement du produit principal" />}
                </CarteIndicateur>
                <CarteIndicateur
                  libelle="Produits obtenus"
                  icone={Package}
                  valeur={memeUnite ? formaterQuantiteLisible(totalObtenu, unitePaddy) : `${obtenus.length} produit${obtenus.length > 1 ? 's' : ''}`}
                  precision={memeUnite && paddy > 0 ? `${formaterPart(totalObtenu, paddy)} du paddy, écart ${formaterQuantiteLisible(ecart, unitePaddy)}` : 'Unités différentes : voir le détail'}
                />
                <CarteIndicateur
                  libelle="Dépenses directes"
                  icone={Receipt}
                  valeur={formaterMontantCompact(depenses)}
                  precision={paddy > 0 && unitePaddy === 'kg' ? `${formaterNombre(depenses / paddy, 1)} FCFA par kg de paddy` : 'Dépenses validées'}
                />
              </div>
              <div className="grille-tableau-de-bord">
                <section className="panneau" aria-labelledby="titre-bilan-matiere">
                  <div className="panneau__entete">
                    <div>
                      <h2 id="titre-bilan-matiere" className="panneau__titre">Bilan matière</h2>
                      <p className="panneau__sous-titre">Ce que devient le paddy consommé</p>
                    </div>
                  </div>
                  {obtenus.length === 0 ? (
                    <p className="texte-doux">Aucun produit obtenu sur la période.</p>
                  ) : (
                    <BarreRepartition
                      titre="Répartition du paddy consommé entre produits obtenus et écart"
                      parts={[
                        ...obtenus.map((ligne) => ({
                          cle: ligne.produit_id,
                          libelle: nomProduit(ligne),
                          valeur: Number(ligne.quantite),
                          texte: `${formaterQuantiteLisible(ligne.quantite, ligne.unite_stock)}${ligne.rendement_pct ? ` · ${formaterNombre(ligne.rendement_pct, 1)} %` : ''}`,
                        })),
                        ...(memeUnite && ecart > 0
                          ? [{ cle: 'ecart', libelle: 'Écart (balles, brisures, pertes)', valeur: ecart, texte: `${formaterQuantiteLisible(ecart, unitePaddy)} · ${formaterPart(ecart, paddy)}`, couleur: 6 }]
                          : []),
                      ]}
                    />
                  )}
                </section>
                <section className="panneau" aria-labelledby="titre-rendements">
                  <h2 id="titre-rendements" className="panneau__titre">Rendement par produit</h2>
                  {obtenus.length === 0 ? (
                    <p className="texte-doux">Aucun produit obtenu sur la période.</p>
                  ) : (
                    <GraphiqueBarres
                      titre="Rendement par produit obtenu"
                      maximum={100}
                      barres={obtenus.map((ligne) => ({
                        cle: ligne.produit_id,
                        libelle: nomProduit(ligne),
                        detail: formaterQuantite(ligne.quantite, ligne.unite_stock),
                        valeur: Number(ligne.rendement_pct ?? 0),
                        texte: ligne.rendement_pct ? `${formaterNombre(ligne.rendement_pct, 1)} %` : '—',
                      }))}
                    />
                  )}
                </section>
              </div>
            </>
          );
        }}
      </BlocRequete>
    </section>
  );
}
