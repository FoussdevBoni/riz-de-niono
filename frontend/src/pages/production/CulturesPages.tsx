import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';
import { FicheDonnees } from '../../components/FicheDonnees';
import { Pagination } from '../../components/Pagination';
import { SelectFiltre } from '../../components/SelectFiltre';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { useMessageNavigation } from '../../hooks/useMessageNavigation';
import { libelleReference } from '../../hooks/useOptionsReference';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { optionsCampagnes, useCampagnesReference } from '../../modules/production/campagnes-agricoles/hooks/useCampagnesAgricoles';
import { CultureFormulaire } from '../../modules/production/cultures/components/CultureFormulaire';
import { cultureService } from '../../modules/production/cultures/services/cultureService';
import { optionsSites, useSitesReference } from '../../modules/production/sites-production/hooks/useSitesProduction';
import { formaterDate, formaterNombre } from '../../utils/formatage';

const BASE = '/production/cultures';
const FILTRES = ['campagne_id', 'site_id', 'page'] as const;

/** /production/cultures : cultures par site et campagne, filtres campagne et site. */
export function CulturesPage() {
  const { profil } = useSession();
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete(
    (signal) => cultureService.lister({ campagne_id: filtres.campagne_id, site_id: filtres.site_id, page, taille_page: 25 }, signal),
    [filtres.campagne_id, filtres.site_id, page],
  );
  const campagnesReference = useCampagnesReference(profil);
  const campagnes = optionsCampagnes(campagnesReference);
  const sites = optionsSites(useSitesReference(profil));
  const limiteAuxSites = (profil?.site_ids.length ?? 0) > 0;
  return (
    <section>
      <EnTetePage
        titre="Cultures"
        sousTitre="Site, campagne, culture, variété et superficie."
        actions={
          possedePermission(profil, 'cultures', 'saisie') && (
            <Link to={`${BASE}/nouveau${filtres.campagne_id ? `?campagne_id=${filtres.campagne_id}` : ''}`} className="bouton">
              Nouvelle culture
            </Link>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des cultures">
        {campagnes.length > 0 && (
          <SelectFiltre libelle="Campagne" libelleTous="Toutes les campagnes" valeur={filtres.campagne_id ?? ''} options={campagnes} onChange={(valeur) => definir('campagne_id', valeur)} />
        )}
        {sites.length > 0 && (
          <SelectFiltre libelle="Site" libelleTous={limiteAuxSites ? 'Tous mes sites' : 'Tous les sites'} valeur={filtres.site_id ?? ''} options={sites} onChange={(valeur) => definir('site_id', valeur)} />
        )}
        {(filtres.campagne_id || filtres.site_id) && (
          <button type="button" className="bouton bouton--fantome-sombre" onClick={reinitialiser}>
            Effacer les filtres
          </button>
        )}
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des cultures…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucune culture">
              <p>{filtres.campagne_id || filtres.site_id ? 'Aucune culture ne correspond à ces filtres.' : 'Les cultures enregistrées apparaîtront ici.'}</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <div className="tableau-defilant">
                <table className="tableau">
                  <thead>
                    <tr>
                      <th scope="col">Culture</th>
                      <th scope="col">Variété</th>
                      <th scope="col">Campagne</th>
                      <th scope="col">Site</th>
                      <th scope="col" className="nombre">Superficie</th>
                      <th scope="col">Semis</th>
                      <th scope="col" className="colonne-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultats.items.map((culture) => (
                      <TableRow key={culture._id} actions={<ActionsFiche
                          to={`${BASE}/${culture._id}`}
                          contexte={culture.culture}
                          modifier={possedePermission(profil, 'cultures', 'saisie') && campagnesReference.some(
                            (campagne) => campagne._id === culture.campagne_id && campagne.statut !== 'cloturee',
                          )}
                        />}>
                        <th scope="row">
                          <Link to={`${BASE}/${culture._id}`}>{culture.culture}</Link>
                        </th>
                        <td>{culture.variete ?? '—'}</td>
                        <td>{libelleReference(campagnes, culture.campagne_id, 'Nom de la campagne indisponible')}</td>
                        <td>{libelleReference(sites, culture.site_id, 'Nom du site indisponible')}</td>
                        <td className="nombre">{formaterNombre(culture.superficie_ha)} ha</td>
                        <td>{formaterDate(culture.date_semis)}</td>
                      </TableRow>
                    ))}
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

export function CultureNouveauPage() {
  const { profil } = useSession();
  const navigate = useNavigationEdition();
  const [parametres] = useSearchParams();
  const campagnes = useCampagnesReference(profil);
  const sites = useSitesReference(profil);
  return (
    <section className="page-etroite">
      <EnTetePage titre="Nouvelle culture" />
      <CultureFormulaire
        campagnes={campagnes}
        sites={sites}
        campagneInitiale={parametres.get('campagne_id') ?? undefined}
        retour={BASE}
        onEnregistrer={async (donnees) => {
          const culture = await cultureService.creer(donnees);
          navigate(`${BASE}/${culture._id}`, { state: { message: 'Culture enregistrée.' } });
        }}
      />
    </section>
  );
}

export function CultureModifierPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const navigate = useNavigationEdition();
  const requete = useRequete((signal) => cultureService.consulter(id, signal), [id]);
  const campagnes = useCampagnesReference(profil);
  const sites = useSitesReference(profil);
  return (
    <section className="page-etroite">
      <EnTetePage titre="Modifier la culture" />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de la culture…">
        {(culture) => (
          <CultureFormulaire
            culture={culture}
            campagnes={campagnes}
            sites={sites}
            retour={`${BASE}/${id}`}
            onEnregistrer={async (donnees) => {
              await cultureService.modifier(id, donnees);
              navigate(`${BASE}/${id}`, { state: { message: 'Modifications enregistrées.' } });
            }}
          />
        )}
      </BlocRequete>
    </section>
  );
}

/** /production/cultures/:id : modifiable tant que la campagne n'est pas clôturée (l'API le contrôle). */
export function CulturePage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const [message] = useState(useMessageNavigation());
  const requete = useRequete((signal) => cultureService.consulter(id, signal), [id]);
  const campagnes = useCampagnesReference(profil);
  const sites = optionsSites(useSitesReference(profil));
  const culture = requete.donnees;
  const campagne = campagnes.find((element) => element._id === culture?.campagne_id);
  const peutModifier = possedePermission(profil, 'cultures', 'saisie') && campagne?.statut !== 'cloturee';
  return (
    <section className="page-etroite">
      <EnTetePage
        retour={{ to: BASE, libelle: 'Retour aux cultures' }}
        titre={culture ? `${culture.culture}${culture.variete ? ` · ${culture.variete}` : ''}` : 'Culture'}
        sousTitre={culture ? libelleReference(sites, culture.site_id, 'Nom du site indisponible') : undefined}
        actions={
          culture &&
          peutModifier && (
            <Link to={`${BASE}/${id}/modifier`} className="bouton bouton--secondaire">
              Modifier
            </Link>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      {campagne?.statut === 'cloturee' && <Alerte ton="information">Campagne clôturée : la culture reste consultable mais n’est plus modifiable.</Alerte>}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de la culture…">
        {(fiche) => (
          <FicheDonnees
            lignes={[
              ['Culture', fiche.culture],
              ['Variété', fiche.variete],
              ['Campagne', libelleReference(optionsCampagnes(campagnes), fiche.campagne_id, 'Nom de la campagne indisponible')],
              ['Site', libelleReference(sites, fiche.site_id, 'Nom du site indisponible')],
              ['Superficie cultivée', `${formaterNombre(fiche.superficie_ha)} ha`],
              ['Date de semis', fiche.date_semis ? formaterDate(fiche.date_semis) : null],
              ['Modifiée le', formaterDate(fiche.updated_at)],
            ]}
          />
        )}
      </BlocRequete>
    </section>
  );
}
