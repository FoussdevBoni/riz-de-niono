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
import { useEquipesReference } from '../../modules/production/equipes-production/hooks/useEquipesReference';
import { operationAgricoleService } from '../../modules/production/operations-agricoles/services/operationAgricoleService';
import { OPTIONS_STATUT_PRODUCTION, STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { optionsSites, useSitesReference } from '../../modules/production/sites-production/hooks/useSitesProduction';
import { useTypesOperationsReference } from '../../modules/production/types-operations-agricoles/hooks/useTypesOperationsReference';
import { formaterDate } from '../../utils/formatage';

const BASE = '/production/operations-agricoles';
const FILTRES = ['campagne_id', 'site_id', 'statut', 'page'] as const;

/** /production/operations-agricoles : travaux du périmètre, filtres campagne, site et statut. */
export function OperationsAgricolesPage() {
  const { profil } = useSession();
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete(
    (signal) =>
      operationAgricoleService.lister({ campagne_id: filtres.campagne_id, site_id: filtres.site_id, statut: filtres.statut, page, taille_page: 25 }, signal),
    [filtres.campagne_id, filtres.site_id, filtres.statut, page],
  );
  const campagnes = optionsCampagnes(useCampagnesReference(profil));
  const sites = optionsSites(useSitesReference(profil));
  const types = useTypesOperationsReference(profil);
  const equipes = useEquipesReference(profil);
  const limiteAuxSites = (profil?.site_ids.length ?? 0) > 0;
  const filtre = Boolean(filtres.campagne_id || filtres.site_id || filtres.statut);

  return (
    <section>
      <EnTetePage
        titre="Travaux agricoles"
        sousTitre={limiteAuxSites ? 'Travaux des sites qui vous sont attribués.' : 'Travaux, équipes et intrants utilisés.'}
        actions={
          possedePermission(profil, 'operations_agricoles', 'saisie') && (
            <Link to={`${BASE}/nouveau${filtres.campagne_id ? `?campagne_id=${filtres.campagne_id}` : ''}`} className="bouton">
              Saisir un travail
            </Link>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des travaux">
        {campagnes.length > 0 && (
          <SelectFiltre libelle="Campagne" libelleTous="Toutes les campagnes" valeur={filtres.campagne_id ?? ''} options={campagnes} onChange={(valeur) => definir('campagne_id', valeur)} />
        )}
        {sites.length > 0 && (
          <SelectFiltre libelle="Site" libelleTous={limiteAuxSites ? 'Tous mes sites' : 'Tous les sites'} valeur={filtres.site_id ?? ''} options={sites} onChange={(valeur) => definir('site_id', valeur)} />
        )}
        <SelectFiltre libelle="Statut" libelleTous="Tous les statuts" valeur={filtres.statut ?? ''} options={OPTIONS_STATUT_PRODUCTION} onChange={(valeur) => definir('statut', valeur)} />
        {filtre && (
          <button type="button" className="bouton bouton--fantome-sombre" onClick={reinitialiser}>
            Effacer les filtres
          </button>
        )}
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des travaux…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucun travail">
              <p>{filtre ? 'Aucun travail ne correspond à ces filtres.' : 'Les travaux agricoles saisis apparaîtront ici.'}</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionGroupee
                items={resultats.items}
                eligible={(ligne) => actionTransactionAutorisee('annuler', possedePermission(profil, 'operations_agricoles', 'validation'), 'standard', ligne)}
                nom={(ligne) => `Opération du ${formaterDate(ligne.date_operation)}`}
                action="Annuler les lignes"
                titre="Confirmer l’annulation"
                motif
                executer={operationAgricoleService.annuler}
                actualiser={requete.recharger}
              >
                {({ entete, caseLigne }) => (
                  <div className="tableau-defilant">
                    <table className="tableau">
                      <thead>
                        <tr>
                          {entete && <th scope="col" className="colonne-selection">{entete}</th>}
                          <th scope="col">Date</th>
                          <th scope="col">Travail</th>
                          <th scope="col">Campagne</th>
                          <th scope="col">Site</th>
                          <th scope="col">Équipe</th>
                          <th scope="col" className="nombre">Intrants</th>
                          <th scope="col">Statut</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((operation) => (
                          <TableRow
                            key={operation._id}
                            selection={caseLigne(operation)}
                            actions={
                              <ActionsFiche
                                to={`${BASE}/${operation._id}`}
                                autres={optionsTransaction(`${BASE}/${operation._id}`, possedePermission(profil, 'operations_agricoles', 'validation'), 'standard', operation)}
                                modifier={operation.statut === 'brouillon' && possedePermission(profil, 'operations_agricoles', 'saisie')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${BASE}/${operation._id}`}>{formaterDate(operation.date_operation)}</Link>
                            </th>
                            <td>{types.find((type) => type._id === operation.type_operation_id)?.nom ?? '—'}</td>
                            <td>{libelleReference(campagnes, operation.campagne_id, 'Nom de la campagne indisponible')}</td>
                            <td>{libelleReference(sites, operation.site_id, 'Nom du site indisponible')}</td>
                            <td>{operation.equipe_id ? (equipes.find((equipe) => equipe._id === operation.equipe_id)?.nom ?? '—') : '—'}</td>
                            <td className="nombre">{operation.intrants.length}</td>
                            <td>
                              <PastilleStatut {...STATUTS_PRODUCTION[operation.statut]} />
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
