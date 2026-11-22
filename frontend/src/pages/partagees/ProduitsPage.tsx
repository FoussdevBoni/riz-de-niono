import ActionsArchivage from '../../components/ActionsArchivage';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { Link } from 'react-router';

import { BlocRequete } from '../../components/BlocRequete';
import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';
import { Pagination } from '../../components/Pagination';
import { PastilleStatut } from '../../components/PastilleStatut';
import { SelectFiltre } from '../../components/SelectFiltre';
import { useActiviteCourante } from '../../hooks/useActiviteCourante';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { libelleReference } from '../../hooks/useOptionsReference';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { optionsCategories, useCategoriesReference } from '../../modules/categories-produits/hooks/useCategoriesReference';
import { produitService } from '../../modules/produits/services/produitService';
import { LIBELLES_ACTIVITES } from '../../modules/produits/utils/libellesProduits';
import { formaterMontant } from '../../utils/formatage';

const FILTRES = ['categorie_id', 'activite', 'page'] as const;

/** /:activite/produits : produits visibles (une de leurs activités dans le périmètre), filtres catégorie et usage. */
export function ProduitsPage() {
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const base = `/${activite}/produits`;
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete(
    (signal) => produitService.lister({ categorie_id: filtres.categorie_id, activite: filtres.activite, page, taille_page: 25 }, signal),
    [filtres.categorie_id, filtres.activite, page],
  );
  const categories = optionsCategories(useCategoriesReference(profil));
  const usages = (profil?.activites ?? []).map((code) => ({ valeur: code, libelle: LIBELLES_ACTIVITES[code] }));

  return (
    <section>
      <EnTetePage
        titre="Produits"
        sousTitre="Référence, catégorie, unité, usages, disponibilité et prix de vente."
        actions={
          possedePermission(profil, 'produits', 'saisie') && (
            <Link to={`${base}/nouveau`} className="bouton">
              Nouveau produit
            </Link>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des produits">
        {categories.length > 0 && (
          <SelectFiltre libelle="Catégorie" libelleTous="Toutes les catégories" valeur={filtres.categorie_id ?? ''} options={categories} onChange={(valeur) => definir('categorie_id', valeur)} />
        )}
        {usages.length > 1 && (
          <SelectFiltre libelle="Usage" libelleTous="Tous les usages" valeur={filtres.activite ?? ''} options={usages} onChange={(valeur) => definir('activite', valeur)} />
        )}
        {(filtres.categorie_id || filtres.activite) && (
          <button type="button" className="bouton bouton--fantome-sombre" onClick={reinitialiser}>
            Effacer les filtres
          </button>
        )}
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des produits…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucun produit">
              <p>{filtres.categorie_id || filtres.activite ? 'Aucun produit ne correspond à ces filtres.' : 'Les produits enregistrés apparaîtront ici.'}</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionsArchivage
                items={resultats.items}
                autorise={possedePermission(profil, 'produits', 'saisie')}
                modifier={(id, actif) => produitService.modifier(id, { actif })}
                actualiser={requete.recharger}
              >
                {({ entete, caseLigne, menu }) => (
                  <div className="tableau-defilant">
                    <table className="tableau">
                      <thead>
                        <tr>
                          {entete && <th scope="col" className="colonne-selection">{entete}</th>}
                          <th scope="col">Code</th>
                          <th scope="col">Nom</th>
                          <th scope="col">Catégorie</th>
                          <th scope="col">Unité</th>
                          <th scope="col">Usages</th>
                          <th scope="col" className="nombre">Prix de vente</th>
                          <th scope="col">État</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((produit) => (
                          <TableRow
                            key={produit._id}
                            selection={caseLigne(produit)}
                            actions={
                              <ActionsFiche
                                to={`${base}/${produit._id}`}
                                autres={menu(produit)}
                                contexte={produit.nom}
                                modifier={possedePermission(profil, 'produits', 'saisie')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${base}/${produit._id}`}>{produit.code}</Link>
                            </th>
                            <td>{produit.nom}</td>
                            <td>{libelleReference(categories, produit.categorie_id, 'Nom de la catégorie indisponible')}</td>
                            <td>{produit.unite_stock}</td>
                            <td>{produit.activites.map((code) => LIBELLES_ACTIVITES[code]).join(', ')}</td>
                            <td className="nombre">{produit.prix_vente ? formaterMontant(produit.prix_vente) : '—'}</td>
                            <td>
                              <PastilleStatut libelle={produit.actif ? 'Actif' : 'Archivé'} ton={produit.actif ? 'succes' : 'neutre'} />
                            </td>
                          </TableRow>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ActionsArchivage>
              <Pagination page={resultats.page} taillePage={resultats.taille_page} total={resultats.total} onChange={(suivante) => definir('page', String(suivante))} />
            </div>
          )
        }
      </BlocRequete>
    </section>
  );
}
