import ActionsArchivage from '../../components/ActionsArchivage';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { CreationListe } from '../../components/CreationListe';
import { BlocRequete } from '../../components/BlocRequete';
import { BoutonArchivage } from '../../components/BoutonArchivage';
import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';
import { FicheDonnees } from '../../components/FicheDonnees';
import { Pagination } from '../../components/Pagination';
import { PastilleStatut } from '../../components/PastilleStatut';
import { SelectFiltre } from '../../components/SelectFiltre';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { useMessageNavigation } from '../../hooks/useMessageNavigation';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';
import { useOperationsUnite } from '../../modules/transformation/operations-transformation/hooks/useOperationsTransformation';
import { UniteTransformationFormulaire } from '../../modules/transformation/unites-transformation/components/UniteTransformationFormulaire';
import { uniteTransformationService } from '../../modules/transformation/unites-transformation/services/uniteTransformationService';
import { formaterDate, formaterQuantite } from '../../utils/formatage';

const BASE = '/transformation/unites-transformation';
const FILTRES = ['actif', 'page'] as const;
const OPTIONS_ETAT = [
  { valeur: 'true', libelle: 'Actives' },
  { valeur: 'false', libelle: 'Archivées' },
];

/** /transformation/unites-transformation : unités (rizeries, décortiqueuses), filtre actif. */
export function UnitesTransformationPage() {
  const { profil } = useSession();
  const { filtres, definir } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete((signal) => uniteTransformationService.lister({ actif: filtres.actif, page, taille_page: 25 }, signal), [filtres.actif, page]);
  return (
    <section>
      <EnTetePage
        titre="Unités de transformation"
        sousTitre="Nom, localisation et état des unités."
        actions={
          possedePermission(profil, 'unites_transformation', 'saisie') && (
            <CreationListe
              titre="Nouvelle unité"
              base={BASE}
              message="Unité créée."
              creer={uniteTransformationService.creer}
              actualiser={requete.recharger}
            >
              {({ annuler, enregistrer }) => (
                <UniteTransformationFormulaire
                  retour={BASE}
                  onAnnuler={annuler}
                  onEnregistrer={enregistrer}
                />
              )}
            </CreationListe>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des unités">
        <SelectFiltre libelle="État" libelleTous="Toutes les unités" valeur={filtres.actif ?? ''} options={OPTIONS_ETAT} onChange={(valeur) => definir('actif', valeur)} />
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des unités…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucune unité">
              <p>{filtres.actif ? 'Aucune unité ne correspond à ce filtre.' : 'Les unités de transformation enregistrées apparaîtront ici.'}</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionsArchivage
                items={resultats.items}
                autorise={possedePermission(profil, 'unites_transformation', 'saisie')}
                modifier={(id, actif) => uniteTransformationService.modifier(id, { actif })}
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
                          <th scope="col">Localisation</th>
                          <th scope="col">État</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((unite) => (
                          <TableRow
                            key={unite._id}
                            selection={caseLigne(unite)}
                            actions={
                              <ActionsFiche
                                to={`${BASE}/${unite._id}`}
                                autres={menu(unite)}
                                contexte={unite.nom}
                                modifier={possedePermission(profil, 'unites_transformation', 'saisie')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${BASE}/${unite._id}`}>{unite.code}</Link>
                            </th>
                            <td>{unite.nom}</td>
                            <td>{unite.localisation ?? '—'}</td>
                            <td>
                              <PastilleStatut libelle={unite.actif ? 'Active' : 'Archivée'} ton={unite.actif ? 'succes' : 'neutre'} />
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

export function UniteTransformationNouveauPage() {
  const navigate = useNavigationEdition();
  return (
    <section className="page-etroite">
      <EnTetePage titre="Nouvelle unité de transformation" />
      <UniteTransformationFormulaire
        retour={BASE}
        onEnregistrer={async (donnees) => {
          const unite = await uniteTransformationService.creer(donnees);
          navigate(`${BASE}/${unite._id}`, { state: { message: 'Unité créée.' } });
        }}
      />
    </section>
  );
}

export function UniteTransformationModifierPage() {
  const { id = '' } = useParams();
  const navigate = useNavigationEdition();
  const requete = useRequete((signal) => uniteTransformationService.consulter(id, signal), [id]);
  return (
    <section className="page-etroite">
      <EnTetePage titre="Modifier l’unité" sousTitre={requete.donnees ? `${requete.donnees.nom} (${requete.donnees.code})` : undefined} />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de l’unité…">
        {(unite) => (
          <UniteTransformationFormulaire
            unite={unite}
            retour={`${BASE}/${id}`}
            onEnregistrer={async (donnees) => {
              await uniteTransformationService.modifier(id, donnees);
              navigate(`${BASE}/${id}`, { state: { message: 'Modifications enregistrées.' } });
            }}
          />
        )}
      </BlocRequete>
    </section>
  );
}

/** /transformation/unites-transformation/:id : fiche, archivage selon les droits et dernières opérations. */
export function UniteTransformationPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const requete = useRequete((signal) => uniteTransformationService.consulter(id, signal), [id]);
  const operations = useOperationsUnite(profil, id);
  const produits = useProduitsReference(profil, 'transformation');
  const unite = requete.donnees;
  const paddy = (produitId: string) => produits.find((produit) => produit._id === produitId);
  return (
    <section className="page-etroite">
      <EnTetePage
        retour={{ to: BASE, libelle: 'Retour aux unités' }}
        titre={unite?.nom ?? 'Unité de transformation'}
        sousTitre={unite?.code}
        actions={
          unite &&
          possedePermission(profil, 'unites_transformation', 'saisie') && (
            <>
              <Link to={`${BASE}/${id}/modifier`} className="bouton bouton--secondaire">
                Modifier
              </Link>
              <BoutonArchivage
                actif={unite.actif}
                nature="cette unité"
                consequence="Elle ne sera plus proposée pour les nouvelles opérations et les nouveaux achats ; ses opérations et achats restent consultables, modifiables en brouillon et validables."
                onBasculer={async (actif) => {
                  await uniteTransformationService.modifier(id, { actif });
                  setMessage(actif ? 'Unité réactivée.' : 'Unité archivée.');
                  requete.recharger();
                }}
              />
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de l’unité…">
        {(fiche) => (
          <>
            <FicheDonnees
              lignes={[
                ['Code', fiche.code],
                ['Nom', fiche.nom],
                ['Localisation', fiche.localisation],
                ['État', <PastilleStatut key="etat" libelle={fiche.actif ? 'Active' : 'Archivée'} ton={fiche.actif ? 'succes' : 'neutre'} />],
                ['Modifiée le', formaterDate(fiche.updated_at)],
              ]}
            />
            {possedePermission(profil, 'operations_transformation') && (
              <div className="section-fiche panneau">
                <h2 className="panneau__titre">Dernières opérations</h2>
                {operations.length === 0 ? (
                  <p className="texte-doux">Aucune opération pour cette unité.</p>
                ) : (
                  <table className="tableau">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col" className="nombre">Paddy consommé</th>
                        <th scope="col">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operations.map((operation) => (
                        <tr key={operation._id}>
                          <th scope="row">
                            <Link to={`/transformation/operations-transformation/${operation._id}`}>{formaterDate(operation.date_operation)}</Link>
                          </th>
                          <td className="nombre">{formaterQuantite(operation.quantite_paddy, paddy(operation.paddy_produit_id)?.unite_stock)}</td>
                          <td>
                            <PastilleStatut {...STATUTS_PRODUCTION[operation.statut]} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p>
                  <Link to={`/transformation/operations-transformation?unite_transformation_id=${fiche._id}`} className="lien-avec-icone">Toutes les opérations de cette unité <ArrowRight size={16} aria-hidden="true" /></Link>
                </p>
              </div>
            )}
          </>
        )}
      </BlocRequete>
    </section>
  );
}
