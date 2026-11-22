import ActionsArchivage from '../../components/ActionsArchivage';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { Link } from 'react-router';

import { BlocRequete } from '../../components/BlocRequete';
import { CreationListe } from '../../components/CreationListe';
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
import { SiteProductionFormulaire } from '../../modules/production/sites-production/components/SiteProductionFormulaire';
import { siteProductionService } from '../../modules/production/sites-production/services/siteProductionService';
import { useUtilisateursReference } from '../../modules/utilisateurs/hooks/useUtilisateursReference';
import { formaterNombre } from '../../utils/formatage';

const FILTRES = ['actif', 'page'] as const;
const BASE = '/production/sites-production';
const OPTIONS_ETAT = [
  { valeur: 'true', libelle: 'Actifs' },
  { valeur: 'false', libelle: 'Archivés' },
];

/** /production/sites-production : liste des sites du périmètre, filtre actif. */
export function SitesProductionPage() {
  const { profil } = useSession();
  const { filtres, definir } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete(
    (signal) => siteProductionService.lister({ actif: filtres.actif, page, taille_page: 25 }, signal),
    [filtres.actif, page],
  );
  const utilisateurs = useUtilisateursReference(profil);
  const responsables = utilisateurs.map((utilisateur) => ({ valeur: utilisateur._id, libelle: utilisateur.nom }));
  // Un utilisateur limité à certains sites ne crée pas de site (document 04).
  const peutCreer = possedePermission(profil, 'sites_production', 'saisie') && profil?.site_ids.length === 0;

  return (
    <section>
      <EnTetePage
        titre="Sites de production"
        sousTitre="Localisation, superficie et responsable de chaque site."
        actions={
          peutCreer && (
            <CreationListe
              titre="Nouveau site"
              base={BASE}
              message="Site créé."
              creer={siteProductionService.creer}
              actualiser={requete.recharger}
            >
              {({ annuler, enregistrer }) => (
                <SiteProductionFormulaire
                  utilisateurs={utilisateurs}
                  retour={BASE}
                  onAnnuler={annuler}
                  onEnregistrer={enregistrer}
                />
              )}
            </CreationListe>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des sites">
        <SelectFiltre libelle="État" libelleTous="Tous les sites" valeur={filtres.actif ?? ''} options={OPTIONS_ETAT} onChange={(valeur) => definir('actif', valeur)} />
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des sites…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucun site">
              <p>{filtres.actif ? 'Aucun site ne correspond à ce filtre.' : 'Les sites de production enregistrés apparaîtront ici.'}</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionsArchivage
                items={resultats.items}
                autorise={possedePermission(profil, 'sites_production', 'saisie')}
                modifier={(id, actif) => siteProductionService.modifier(id, { actif })}
                actualiser={requete.recharger}
                note="Un site archivé ne peut plus être associé à une campagne ni recevoir de nouvelle saisie. Son historique reste consultable."
              >
                {({ entete, caseLigne, menu }) => (
                  <div className="tableau-defilant">
                    <table className="tableau">
                      <thead>
                        <tr>
                          {entete && <th scope="col" className="colonne-selection">{entete}</th>}
                          <th scope="col">Code</th>
                          <th scope="col">Nom</th>
                          <th scope="col">Localisation</th>
                          <th scope="col" className="nombre">Superficie</th>
                          <th scope="col">Responsable</th>
                          <th scope="col">État</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((site) => (
                          <TableRow
                            key={site._id}
                            selection={caseLigne(site)}
                            actions={
                              <ActionsFiche
                                to={`${BASE}/${site._id}`}
                                contexte={site.nom}
                                autres={menu(site)}
                                modifier={possedePermission(profil, 'sites_production', 'saisie')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${BASE}/${site._id}`}>{site.code}</Link>
                            </th>
                            <td>{site.nom}</td>
                            <td>{site.localisation ?? '—'}</td>
                            <td className="nombre">{site.superficie_ha ? `${formaterNombre(site.superficie_ha)} ha` : '—'}</td>
                            <td>{site.responsable_id ? libelleReference(responsables, site.responsable_id, 'Nom du responsable indisponible') : '—'}</td>
                            <td>
                              <PastilleStatut libelle={site.actif ? 'Actif' : 'Archivé'} ton={site.actif ? 'succes' : 'neutre'} />
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
