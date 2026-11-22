import { Hourglass, Receipt, ShoppingCart, Store, Truck, Wallet } from 'lucide-react';

import { Alerte } from '../../components/Alerte';
import { GraphiqueAnneau } from '../../components/graphiques/GraphiqueAnneau';
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
  useOptionsTableauCommercialisation,
  useTableauDeBordCommercialisation,
} from '../../modules/commercialisation/tableau-de-bord/hooks/useTableauDeBordCommercialisation';
import { formaterMontant, formaterMontantCompact, formaterPart, formaterQuantite, formaterQuantiteLisible } from '../../utils/formatage';

const FILTRES = ['date_debut', 'date_fin', 'client_id', 'produit_id'] as const;

/** /commercialisation/tableau-de-bord : ventes, commandes livrées, encaissements et soldes. */
export function TableauDeBordCommercialisationPage() {
  const { profil } = useSession();
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const requete = useTableauDeBordCommercialisation(filtres);
  const { clients, produits } = useOptionsTableauCommercialisation(profil);

  return (
    <section>
      <EnTetePage titre="Tableau de bord commercial" sousTitre="Chiffre d’affaires, encaissements, reste à encaisser et quantités vendues, par période, client et produit." />
      <div className="barre-filtres" role="search" aria-label="Filtres du tableau de bord">
        <div className="champ--compact">
          <ChampFormulaire libelle="Du" type="date" value={filtres.date_debut ?? ''} onChange={(e) => definir('date_debut', e.target.value)} />
        </div>
        <div className="champ--compact">
          <ChampFormulaire libelle="Au" type="date" value={filtres.date_fin ?? ''} onChange={(e) => definir('date_fin', e.target.value)} />
        </div>
        {clients.length > 0 && (
          <SelectFiltre
            libelle="Client"
            libelleTous="Tous les clients"
            valeur={filtres.client_id ?? ''}
            options={clients}
            onChange={(valeur) => definir('client_id', valeur)}
          />
        )}
        {produits.length > 0 && (
          <SelectFiltre
            libelle="Produit"
            libelleTous="Tous les produits"
            valeur={filtres.produit_id ?? ''}
            options={produits}
            onChange={(valeur) => definir('produit_id', valeur)}
          />
        )}
        {Object.keys(filtres).length > 0 && (
          <button type="button" className="bouton bouton--fantome-sombre" onClick={reinitialiser}>
            Effacer les filtres
          </button>
        )}
      </div>
      <BlocRequete {...requete} cartes={5}>
        {(tableau) => {
          const vide =
            tableau.ventes_validees.nombre === 0 &&
            tableau.commandes_livrees.nombre === 0 &&
            Number(tableau.encaissements) === 0 &&
            Number(tableau.depenses_enregistrees) === 0;
          if (vide) {
            return (
              <EtatVide titre="Aucune activité commerciale pour ces filtres" icone={Store}>
                <p>Les ventes validées, livraisons et encaissements de la période apparaîtront ici.</p>
              </EtatVide>
            );
          }
          const tropPercu = Number(tableau.soldes.trop_percu) > 0;
          const du = Math.max(0, Number(tableau.soldes.montant_total) - Number(tableau.soldes.montant_retours));
          const nomProduit = (ligne: { produit_id: string; produit_nom?: string | null }) =>
            ligne.produit_nom ?? libelleReference(produits, ligne.produit_id, 'Produit hors catalogue');
          return (
            <>
              {tropPercu && (
                <Alerte ton="attention" titre="Trop-perçu à traiter">
                  Des retours après paiement laissent un trop-perçu de {formaterMontant(tableau.soldes.trop_percu)} à régler manuellement.
                </Alerte>
              )}
              <div className="grille-indicateurs">
                <CarteIndicateur
                  libelle="Ventes validées"
                  icone={ShoppingCart}
                  ton="accent"
                  valeur={formaterMontantCompact(tableau.ventes_validees.montant_total)}
                  precision={`${tableau.ventes_validees.nombre} vente${tableau.ventes_validees.nombre > 1 ? 's' : ''} · ${formaterMontant(tableau.ventes_validees.montant_total)}`}
                />
                <CarteIndicateur
                  libelle="Encaissé"
                  icone={Wallet}
                  valeur={formaterMontantCompact(tableau.encaissements)}
                  precision={`sur ${formaterMontant(String(du))} à encaisser`}
                >
                  <JaugeProgression valeur={Number(tableau.soldes.montant_encaisse)} total={du} libelle="Part encaissée des ventes" />
                </CarteIndicateur>
                <CarteIndicateur
                  libelle="Reste à encaisser"
                  icone={Hourglass}
                  valeur={formaterMontantCompact(tableau.soldes.solde)}
                  precision={Number(tableau.soldes.montant_retours) > 0 ? `Retours déduits : ${formaterMontant(tableau.soldes.montant_retours)}` : 'Soldes clients des ventes validées'}
                  ton={tropPercu || Number(tableau.soldes.solde) > 0 ? 'attention' : 'succes'}
                />
                <CarteIndicateur
                  libelle="Commandes livrées"
                  icone={Truck}
                  valeur={String(tableau.commandes_livrees.nombre)}
                  precision={formaterMontant(tableau.commandes_livrees.montant_total)}
                />
                <CarteIndicateur libelle="Dépenses commerciales" icone={Receipt} valeur={formaterMontantCompact(tableau.depenses_enregistrees)} precision="Dépenses validées" />
              </div>
              <div className="grille-tableau-de-bord">
                <section className="panneau" aria-labelledby="titre-ventes-produits">
                  <div className="panneau__entete">
                    <div>
                      <h2 id="titre-ventes-produits" className="panneau__titre">Chiffre d’affaires par produit</h2>
                      <p className="panneau__sous-titre">Montant des ventes validées et quantités livrées</p>
                    </div>
                  </div>
                  {tableau.quantites_vendues.length === 0 ? (
                    <p className="texte-doux">Aucune quantité vendue pour ces filtres.</p>
                  ) : (
                    <GraphiqueBarres
                      titre="Chiffre d’affaires par produit"
                      barres={[...tableau.quantites_vendues]
                        .sort((a, b) => Number(b.montant) - Number(a.montant))
                        .map((ligne) => ({
                          cle: ligne.produit_id,
                          libelle: nomProduit(ligne),
                          detail: formaterQuantiteLisible(ligne.quantite, ligne.unite_stock),
                          valeur: Number(ligne.montant),
                          texte: formaterMontantCompact(ligne.montant),
                        }))}
                    />
                  )}
                </section>
                <section className="panneau" aria-labelledby="titre-encaissements">
                  <div className="panneau__entete">
                    <div>
                      <h2 id="titre-encaissements" className="panneau__titre">Situation des paiements</h2>
                      <p className="panneau__sous-titre">Ce qui a été encaissé, retourné et reste dû</p>
                    </div>
                  </div>
                  <GraphiqueAnneau
                    titre="Répartition des ventes entre encaissé, retours et reste dû"
                    centre={formaterPart(Number(tableau.soldes.montant_encaisse), du)}
                    sousCentre="encaissé"
                    segments={[
                      { cle: 'encaisse', libelle: 'Encaissé', valeur: Number(tableau.soldes.montant_encaisse), texte: formaterMontantCompact(tableau.soldes.montant_encaisse), couleur: 1 },
                      { cle: 'solde', libelle: 'Reste dû', valeur: Number(tableau.soldes.solde), texte: formaterMontantCompact(tableau.soldes.solde), couleur: 2 },
                      { cle: 'retours', libelle: 'Retours', valeur: Number(tableau.soldes.montant_retours), texte: formaterMontantCompact(tableau.soldes.montant_retours), couleur: 4 },
                    ]}
                  />
                </section>
              </div>
              {tableau.quantites_vendues.length > 0 && (
                <section className="panneau">
                  <h2 className="panneau__titre">Quantités vendues</h2>
                  <div className="tableau-defilant">
                    <table className="tableau">
                      <thead>
                        <tr>
                          <th scope="col">Produit</th>
                          <th scope="col" className="nombre">Vendu</th>
                          <th scope="col" className="nombre">Retourné</th>
                          <th scope="col" className="nombre">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableau.quantites_vendues.map((ligne) => (
                          <tr key={ligne.produit_id}>
                            <th scope="row">{nomProduit(ligne)}</th>
                            <td className="nombre">{formaterQuantite(ligne.quantite, ligne.unite_stock)}</td>
                            <td className="nombre">{formaterQuantite(ligne.quantite_retournee, ligne.unite_stock)}</td>
                            <td className="nombre">{formaterMontant(ligne.montant)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          );
        }}
      </BlocRequete>
    </section>
  );
}
