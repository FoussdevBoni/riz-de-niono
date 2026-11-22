import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { Link } from 'react-router';

import { BlocRequete } from '../../components/BlocRequete';
import { ChampFormulaire } from '../../components/ChampFormulaire';
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
import { lienOrigine } from '../../modules/stock/utils/lienOrigine';
import { LIBELLES_ORIGINE, LIBELLES_SENS, OPTIONS_ORIGINE, OPTIONS_SENS } from '../../modules/stock/utils/libellesStock';
import { formaterDate, formaterQuantite } from '../../utils/formatage';
import { finDeJournee } from '../../utils/saisie';

const FILTRES = ['produit_id', 'sens', 'origine_type', 'date_debut', 'date_fin', 'page'] as const;

/** /:activite/mouvements-stock : historique des mouvements, filtres et référence d'origine. */
export function MouvementsStockPage() {
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete(
    (signal) =>
      stockService.listerMouvements(
        {
          produit_id: filtres.produit_id,
          sens: filtres.sens,
          origine_type: filtres.origine_type,
          date_debut: filtres.date_debut,
          date_fin: finDeJournee(filtres.date_fin),
          page,
          taille_page: 25,
        },
        signal,
      ),
    [filtres.produit_id, filtres.sens, filtres.origine_type, filtres.date_debut, filtres.date_fin, page],
  );
  const produits = useProduitsReference(profil);
  const filtre = Boolean(filtres.produit_id || filtres.sens || filtres.origine_type || filtres.date_debut || filtres.date_fin);

  return (
    <section>
      <EnTetePage
        titre="Mouvements de stock"
        sousTitre="Entrées et sorties générées par les opérations validées, avec leur origine."
        actions={
          <Link to={`/${activite}/stock`} className="bouton bouton--secondaire">
            Stock disponible
          </Link>
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des mouvements">
        {produits.length > 0 && (
          <SelectFiltre libelle="Produit" libelleTous="Tous les produits" valeur={filtres.produit_id ?? ''} options={optionsProduits(produits)} onChange={(valeur) => definir('produit_id', valeur)} />
        )}
        <SelectFiltre libelle="Sens" libelleTous="Entrées et sorties" valeur={filtres.sens ?? ''} options={OPTIONS_SENS} onChange={(valeur) => definir('sens', valeur)} />
        <SelectFiltre libelle="Origine" libelleTous="Toutes les origines" valeur={filtres.origine_type ?? ''} options={OPTIONS_ORIGINE} onChange={(valeur) => definir('origine_type', valeur)} />
        <div className="champ--compact">
          <ChampFormulaire libelle="Du" type="date" value={filtres.date_debut ?? ''} onChange={(evenement) => definir('date_debut', evenement.target.value)} />
        </div>
        <div className="champ--compact">
          <ChampFormulaire libelle="Au" type="date" value={filtres.date_fin ?? ''} min={filtres.date_debut} onChange={(evenement) => definir('date_fin', evenement.target.value)} />
        </div>
        {filtre && (
          <button type="button" className="bouton bouton--fantome-sombre" onClick={reinitialiser}>
            Effacer les filtres
          </button>
        )}
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des mouvements…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucun mouvement">
              <p>{filtre ? 'Aucun mouvement ne correspond à ces filtres.' : 'Les mouvements apparaissent à la validation des opérations.'}</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <div className="tableau-defilant">
                <table className="tableau">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Produit</th>
                      <th scope="col">Sens</th>
                      <th scope="col" className="nombre">Quantité</th>
                      <th scope="col">Origine</th>
                      <th scope="col">Motif</th>
                      <th scope="col" className="colonne-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultats.items.map((mouvement) => {
                      const produit = produits.find((element) => element._id === mouvement.produit_id);
                      const lien = lienOrigine(profil, mouvement.origine_type, mouvement.origine_id, activite);
                      const origine = `${LIBELLES_ORIGINE[mouvement.origine_type]}${mouvement.annule_mouvement_id ? ' · contre-écriture' : ''}`;
                      return (
                        <TableRow key={mouvement._id} actions={<ActionsFiche to={`/${activite}/mouvements-stock/${mouvement._id}`} />}>
                          <th scope="row">
                            <Link to={`/${activite}/mouvements-stock/${mouvement._id}`}>{formaterDate(mouvement.date_mouvement)}</Link>
                          </th>
                          <td>{produit?.nom ?? mouvement.produit_nom ?? 'Produit hors catalogue'}</td>
                          <td className={mouvement.sens}>{LIBELLES_SENS[mouvement.sens]}</td>
                          <td className="nombre">{formaterQuantite(mouvement.quantite, produit?.unite_stock)}</td>
                          <td>{lien ? <Link to={lien}>{origine}</Link> : origine}</td>
                          <td>{mouvement.motif ?? '—'}</td>
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
