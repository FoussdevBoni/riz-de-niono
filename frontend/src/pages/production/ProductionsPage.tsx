import ActionGroupee from '../../components/ActionGroupee';
import { actionTransactionAutorisee, optionsTransaction } from '../../components/ActionsTransaction';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { Link } from 'react-router';

import { BlocRequete } from '../../components/BlocRequete';
import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';
import { Pagination } from '../../components/Pagination';
import { PastilleStatut } from '../../components/PastilleStatut';
import { SelectFiltre } from '../../components/SelectFiltre';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { libelleReference } from '../../hooks/useOptionsReference';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { optionsCampagnes, useCampagnesReference } from '../../modules/production/campagnes-agricoles/hooks/useCampagnesAgricoles';
import { productionService } from '../../modules/production/productions/services/productionService';
import { OPTIONS_STATUT_PRODUCTION, STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { optionsSites, useSitesReference } from '../../modules/production/sites-production/hooks/useSitesProduction';
import { optionsProduits, useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';
import { formaterDate, formaterNombre, formaterQuantite } from '../../utils/formatage';

const FILTRES = ['campagne_id', 'site_id', 'statut', 'page'] as const;
const BASE = '/production/productions';

/** /production/productions : récoltes du périmètre, filtres campagne, site et statut. */
export function ProductionsPage() {
  const { profil } = useSession();
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete(
    (signal) =>
      productionService.lister(
        { campagne_id: filtres.campagne_id, site_id: filtres.site_id, statut: filtres.statut, page, taille_page: 25 },
        signal,
      ),
    [filtres.campagne_id, filtres.site_id, filtres.statut, page],
  );
  const campagnes = optionsCampagnes(useCampagnesReference(profil));
  const sites = optionsSites(useSitesReference(profil));
  const produits = useProduitsReference(profil, 'production');
  const libellesProduits = optionsProduits(produits);
  const limiteAuxSites = (profil?.site_ids.length ?? 0) > 0;
  const filtre = Boolean(filtres.campagne_id || filtres.site_id || filtres.statut);

  return (
    <section>
      <EnTetePage
        titre="Récoltes"
        sousTitre={limiteAuxSites ? 'Récoltes des sites qui vous sont attribués.' : 'Récoltes par site et par campagne.'}
        actions={
          possedePermission(profil, 'productions', 'saisie') && (
            <Link to={`${BASE}/nouveau${filtres.campagne_id ? `?campagne_id=${filtres.campagne_id}` : ''}`} className="bouton">
              Saisir une récolte
            </Link>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des récoltes">
        {campagnes.length > 0 && (
          <SelectFiltre libelle="Campagne" libelleTous="Toutes les campagnes" valeur={filtres.campagne_id ?? ''} options={campagnes} onChange={(valeur) => definir('campagne_id', valeur)} />
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
        <SelectFiltre libelle="Statut" libelleTous="Tous les statuts" valeur={filtres.statut ?? ''} options={OPTIONS_STATUT_PRODUCTION} onChange={(valeur) => definir('statut', valeur)} />
        {filtre && (
          <button type="button" className="bouton bouton--fantome-sombre" onClick={reinitialiser}>
            Effacer les filtres
          </button>
        )}
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des récoltes…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucune récolte">
              <p>{filtre ? 'Aucune récolte ne correspond à ces filtres.' : 'Les récoltes saisies apparaîtront ici.'}</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionGroupee
                items={resultats.items}
                eligible={(ligne) => actionTransactionAutorisee('annuler', possedePermission(profil, 'productions', 'validation'), 'standard', ligne)}
                nom={(ligne) => `Récolte du ${formaterDate(ligne.date_recolte)}`}
                action="Annuler les lignes"
                titre="Confirmer l’annulation"
                motif
                executer={productionService.annuler}
                actualiser={requete.recharger}
              >
                {({ entete, caseLigne }) => (
                  <div className="tableau-defilant">
                    <table className="tableau">
                      <thead>
                        <tr>
                          {entete && <th scope="col" className="colonne-selection">{entete}</th>}
                          <th scope="col">Date</th>
                          <th scope="col">Campagne</th>
                          <th scope="col">Site</th>
                          <th scope="col">Produit</th>
                          <th scope="col" className="nombre">Quantité</th>
                          <th scope="col" className="nombre">Superficie</th>
                          <th scope="col">Statut</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((production) => (
                          <TableRow
                            key={production._id}
                            selection={caseLigne(production)}
                            actions={
                              <ActionsFiche
                                to={`${BASE}/${production._id}`}
                                autres={optionsTransaction(`${BASE}/${production._id}`, possedePermission(profil, 'productions', 'validation'), 'standard', production)}
                                modifier={production.statut === 'brouillon' && possedePermission(profil, 'productions', 'saisie')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${BASE}/${production._id}`}>{formaterDate(production.date_recolte)}</Link>
                            </th>
                            <td>{libelleReference(campagnes, production.campagne_id, 'Nom de la campagne indisponible')}</td>
                            <td>{libelleReference(sites, production.site_id, 'Nom du site indisponible')}</td>
                            <td>{production.produit_nom ?? libelleReference(libellesProduits, production.produit_id, 'Produit hors catalogue')}</td>
                            <td className="nombre">
                              {formaterQuantite(production.quantite, produits.find((produit) => produit._id === production.produit_id)?.unite_stock)}
                            </td>
                            <td className="nombre">{formaterNombre(production.superficie_recoltee_ha)} ha</td>
                            <td>
                              <PastilleStatut {...STATUTS_PRODUCTION[production.statut]} />
                            </td>
                          </TableRow>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ActionGroupee>
              <Pagination page={resultats.page} taillePage={resultats.taille_page} total={resultats.total} onChange={(suivante) => definir('page', String(suivante))} />
            </div>
          )
        }
      </BlocRequete>
    </section>
  );
}
