import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { BlocRequete } from '../../components/BlocRequete';
import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';
import { Pagination } from '../../components/Pagination';
import { SelectFiltre } from '../../components/SelectFiltre';
import { useActiviteCourante } from '../../hooks/useActiviteCourante';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { optionsProduits, useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';
import { stockService } from '../../modules/stock/services/stockService';
import { formaterDate, formaterNombre } from '../../utils/formatage';

const FILTRES = ['produit_id', 'page'] as const;

/** /:activite/stock : stock global disponible par produit (non filtré par activité ni par site). */
export function StockPage() {
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const { filtres, definir } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete(
    (signal) => stockService.listerStocks({ produit_id: filtres.produit_id, page, taille_page: 25 }, signal),
    [filtres.produit_id, page],
  );
  const produits = useProduitsReference(profil);

  return (
    <section>
      <EnTetePage titre="Stock disponible" sousTitre="Quantités globales par produit, toutes activités et tous sites confondus." />
      {produits.length > 0 && (
        <div className="barre-filtres" role="search" aria-label="Filtres du stock">
          <SelectFiltre
            libelle="Produit"
            libelleTous="Tous les produits"
            valeur={filtres.produit_id ?? ''}
            options={optionsProduits(produits)}
            onChange={(valeur) => definir('produit_id', valeur)}
          />
        </div>
      )}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du stock…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucun stock">
              <p>Les produits apparaissent ici dès leur premier mouvement de stock.</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <div className="tableau-defilant">
                <table className="tableau">
                  <thead>
                    <tr>
                      <th scope="col">Produit</th>
                      <th scope="col" className="nombre">Disponible</th>
                      <th scope="col">Dernier mouvement</th>
                      <th scope="col" className="colonne-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultats.items.map((stock) => {
                      const produit = produits.find((element) => element._id === stock.produit_id);
                      return (
                        <TableRow
                          key={stock._id}
                          actions={
                            <ActionsFiche
                              to={`/${activite}/mouvements-stock?produit_id=${stock.produit_id}`}
                              label="Voir les mouvements"
                              contexte={produit?.nom ?? stock.produit_nom ?? undefined}
                            />
                          }
                        >
                          <th scope="row">
                            {produit?.nom ?? stock.produit_nom ?? 'Produit hors catalogue'}
                            {produit && <span className="campagne-code">{produit.code}</span>}
                          </th>
                          <td className="nombre">
                            <strong>{formaterNombre(stock.quantite_disponible, 3)}</strong> {stock.unite_stock ?? ''}
                          </td>
                          <td>{formaterDate(stock.updated_at)}</td>
                        </TableRow>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={resultats.page} taillePage={resultats.taille_page} total={resultats.total} onChange={(suivante) => definir('page', String(suivante))} />
            </div>
          )
        }
      </BlocRequete>
    </section>
  );
}
