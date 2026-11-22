import ActionsArchivage from '../../components/ActionsArchivage';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
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
import { EquipeProductionFormulaire } from '../../modules/production/equipes-production/components/EquipeProductionFormulaire';
import { equipeProductionService } from '../../modules/production/equipes-production/services/equipeProductionService';
import { useTravauxEquipe } from '../../modules/production/operations-agricoles/hooks/useOperationsAgricoles';
import { STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { useTypesOperationsReference } from '../../modules/production/types-operations-agricoles/hooks/useTypesOperationsReference';
import { formaterDate } from '../../utils/formatage';

const BASE = '/production/equipes-production';
const FILTRES = ['actif', 'page'] as const;
const OPTIONS_ETAT = [
  { valeur: 'true', libelle: 'Actives' },
  { valeur: 'false', libelle: 'Archivées' },
];

/** /production/equipes-production : équipes et nombre de membres, filtre actif. */
export function EquipesProductionPage() {
  const { profil } = useSession();
  const { filtres, definir } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete((signal) => equipeProductionService.lister({ actif: filtres.actif, page, taille_page: 25 }, signal), [filtres.actif, page]);
  return (
    <section>
      <EnTetePage
        titre="Équipes de production"
        sousTitre="Membres et travaux associés."
        actions={
          possedePermission(profil, 'equipes_production', 'saisie') && (
            <Link to={`${BASE}/nouveau`} className="bouton">
              Nouvelle équipe
            </Link>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des équipes">
        <SelectFiltre libelle="État" libelleTous="Toutes les équipes" valeur={filtres.actif ?? ''} options={OPTIONS_ETAT} onChange={(valeur) => definir('actif', valeur)} />
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des équipes…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucune équipe">
              <p>Les équipes enregistrées apparaîtront ici.</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionsArchivage
                items={resultats.items}
                autorise={possedePermission(profil, 'equipes_production', 'saisie')}
                modifier={(id, actif) => equipeProductionService.modifier(id, { actif })}
                actualiser={requete.recharger}
              >
                {({ entete, caseLigne, menu }) => (
                  <table className="tableau">
                    <thead>
                      <tr>
                        {entete && <th scope="col" className="colonne-selection">{entete}</th>}
                        <th scope="col">Nom</th>
                        <th scope="col" className="nombre">Membres</th>
                        <th scope="col">État</th>
                        <th scope="col" className="colonne-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultats.items.map((equipe) => (
                        <TableRow
                          key={equipe._id}
                          selection={caseLigne(equipe)}
                          actions={
                            <ActionsFiche
                              to={`${BASE}/${equipe._id}`}
                              autres={menu(equipe)}
                              contexte={equipe.nom}
                              modifier={possedePermission(profil, 'equipes_production', 'saisie')}
                            />
                          }
                        >
                          <th scope="row">
                            <Link to={`${BASE}/${equipe._id}`}>{equipe.nom}</Link>
                          </th>
                          <td className="nombre">{equipe.membres.length}</td>
                          <td>
                            <PastilleStatut libelle={equipe.actif ? 'Active' : 'Archivée'} ton={equipe.actif ? 'succes' : 'neutre'} />
                          </td>
                        </TableRow>
                      ))}
                    </tbody>
                  </table>
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

export function EquipeProductionNouveauPage() {
  const navigate = useNavigationEdition();
  return (
    <section className="page-etroite">
      <EnTetePage titre="Nouvelle équipe de production" />
      <EquipeProductionFormulaire
        retour={BASE}
        onEnregistrer={async (donnees) => {
          const equipe = await equipeProductionService.creer(donnees);
          navigate(`${BASE}/${equipe._id}`, { state: { message: 'Équipe créée.' } });
        }}
      />
    </section>
  );
}

export function EquipeProductionModifierPage() {
  const { id = '' } = useParams();
  const navigate = useNavigationEdition();
  const requete = useRequete((signal) => equipeProductionService.consulter(id, signal), [id]);
  return (
    <section className="page-etroite">
      <EnTetePage titre="Modifier l’équipe" sousTitre={requete.donnees?.nom} />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de l’équipe…">
        {(equipe) => (
          <EquipeProductionFormulaire
            equipe={equipe}
            retour={`${BASE}/${id}`}
            onEnregistrer={async (donnees) => {
              await equipeProductionService.modifier(id, donnees);
              navigate(`${BASE}/${id}`, { state: { message: 'Modifications enregistrées.' } });
            }}
          />
        )}
      </BlocRequete>
    </section>
  );
}

/** /production/equipes-production/:id : membres et travaux associés visibles par l'utilisateur. */
export function EquipeProductionPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const requete = useRequete((signal) => equipeProductionService.consulter(id, signal), [id]);
  const travaux = useTravauxEquipe(profil, id);
  const types = useTypesOperationsReference(profil);
  const equipe = requete.donnees;
  return (
    <section className="page-etroite">
      <EnTetePage
        retour={{ to: BASE, libelle: 'Retour aux équipes' }}
        titre={equipe?.nom ?? 'Équipe de production'}
        actions={
          equipe &&
          possedePermission(profil, 'equipes_production', 'saisie') && (
            <>
              <Link to={`${BASE}/${id}/modifier`} className="bouton bouton--secondaire">
                Modifier
              </Link>
              <BoutonArchivage
                actif={equipe.actif}
                nature="cette équipe"
                onBasculer={async (actif) => {
                  await equipeProductionService.modifier(id, { actif });
                  setMessage(actif ? 'Équipe réactivée.' : 'Équipe archivée.');
                  requete.recharger();
                }}
              />
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de l’équipe…">
        {(fiche) => (
          <>
            <FicheDonnees
              lignes={[
                ['Nom', fiche.nom],
                ['Membres', fiche.membres.length === 0 ? null : fiche.membres.map((membre) => <span key={membre} className="pastille pastille--neutre">{membre}</span>)],
                ['État', <PastilleStatut key="etat" libelle={fiche.actif ? 'Active' : 'Archivée'} ton={fiche.actif ? 'succes' : 'neutre'} />],
              ]}
            />
            {possedePermission(profil, 'operations_agricoles') && (
              <div className="section-fiche panneau">
                <h2 className="panneau__titre">Travaux associés</h2>
                {travaux.length === 0 ? (
                  <p className="texte-doux">Aucun travail enregistré pour cette équipe dans votre périmètre.</p>
                ) : (
                  <table className="tableau">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Travail</th>
                        <th scope="col">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {travaux.map((travail) => (
                        <tr key={travail._id}>
                          <th scope="row">
                            <Link to={`/production/operations-agricoles/${travail._id}`}>{formaterDate(travail.date_operation)}</Link>
                          </th>
                          <td>{types.find((type) => type._id === travail.type_operation_id)?.nom ?? '—'}</td>
                          <td>
                            <PastilleStatut {...STATUTS_PRODUCTION[travail.statut]} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </BlocRequete>
    </section>
  );
}
