import ActionsArchivage from '../../components/ActionsArchivage';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { BoutonArchivage } from '../../components/BoutonArchivage';
import { CoordonneesFormulaire } from '../../components/CoordonneesFormulaire';
import { CreationListe } from '../../components/CreationListe';
import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';
import { FicheDonnees } from '../../components/FicheDonnees';
import { Pagination } from '../../components/Pagination';
import { PastilleStatut } from '../../components/PastilleStatut';
import { SelectFiltre } from '../../components/SelectFiltre';
import { useActiviteCourante } from '../../hooks/useActiviteCourante';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { useMessageNavigation } from '../../hooks/useMessageNavigation';
import { useRequete } from '../../hooks/useRequete';
import { useAchatsFournisseur } from '../../modules/achats/hooks/useAchats';
import { STATUTS_RECEPTION } from '../../modules/achats/utils/libellesAchats';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { fournisseurService } from '../../modules/fournisseurs/services/fournisseurService';
import { STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { formaterDate, formaterMontant } from '../../utils/formatage';

const FILTRES = ['actif', 'page'] as const;
const OPTIONS_ETAT = [
  { valeur: 'true', libelle: 'Actifs' },
  { valeur: 'false', libelle: 'Archivés' },
];

function useBase() {
  return `/${useActiviteCourante()}/fournisseurs`;
}

/** /:activite/fournisseurs : fournisseurs communs aux trois activités, filtre actif. */
export function FournisseursPage() {
  const { profil } = useSession();
  const base = useBase();
  const { filtres, definir } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete((signal) => fournisseurService.lister({ actif: filtres.actif, page, taille_page: 25 }, signal), [filtres.actif, page]);
  return (
    <section>
      <EnTetePage
        titre="Fournisseurs"
        sousTitre="Coordonnées et achats associés."
        actions={
          possedePermission(profil, 'fournisseurs', 'saisie') && (
            <CreationListe
              titre="Nouveau fournisseur"
              base={base}
              message="Fournisseur créé."
              creer={fournisseurService.creer}
              actualiser={requete.recharger}
            >
              {({ annuler, enregistrer }) => (
                <CoordonneesFormulaire
                  retour={base}
                  onAnnuler={annuler}
                  onEnregistrer={enregistrer}
                />
              )}
            </CreationListe>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des fournisseurs">
        <SelectFiltre libelle="État" libelleTous="Tous les fournisseurs" valeur={filtres.actif ?? ''} options={OPTIONS_ETAT} onChange={(valeur) => definir('actif', valeur)} />
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des fournisseurs…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucun fournisseur">
              <p>{filtres.actif ? 'Aucun fournisseur ne correspond à ce filtre.' : 'Les fournisseurs enregistrés apparaîtront ici.'}</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionsArchivage
                items={resultats.items}
                autorise={possedePermission(profil, 'fournisseurs', 'saisie')}
                modifier={(id, actif) => fournisseurService.modifier(id, { actif })}
                actualiser={requete.recharger}
              >
                {({ entete, caseLigne, menu }) => (
                  <div className="tableau-defilant">
                    <table className="tableau">
                      <thead>
                        <tr>
                          {entete && <th scope="col" className="colonne-selection">{entete}</th>}
                          <th scope="col">Nom</th>
                          <th scope="col">Téléphone</th>
                          <th scope="col">Adresse</th>
                          <th scope="col">État</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((fournisseur) => (
                          <TableRow
                            key={fournisseur._id}
                            selection={caseLigne(fournisseur)}
                            actions={
                              <ActionsFiche
                                to={`${base}/${fournisseur._id}`}
                                autres={menu(fournisseur)}
                                contexte={fournisseur.nom}
                                modifier={possedePermission(profil, 'fournisseurs', 'saisie')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${base}/${fournisseur._id}`}>{fournisseur.nom}</Link>
                            </th>
                            <td>{fournisseur.telephone ?? '—'}</td>
                            <td>{fournisseur.adresse ?? '—'}</td>
                            <td>
                              <PastilleStatut libelle={fournisseur.actif ? 'Actif' : 'Archivé'} ton={fournisseur.actif ? 'succes' : 'neutre'} />
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

export function FournisseurNouveauPage() {
  const base = useBase();
  const navigate = useNavigationEdition();
  return (
    <section className="page-etroite">
      <EnTetePage titre="Nouveau fournisseur" />
      <CoordonneesFormulaire
        retour={base}
        onEnregistrer={async (donnees) => {
          const fournisseur = await fournisseurService.creer(donnees);
          navigate(`${base}/${fournisseur._id}`, { state: { message: 'Fournisseur créé.' } });
        }}
      />
    </section>
  );
}

export function FournisseurModifierPage() {
  const { id = '' } = useParams();
  const base = useBase();
  const navigate = useNavigationEdition();
  const requete = useRequete((signal) => fournisseurService.consulter(id, signal), [id]);
  return (
    <section className="page-etroite">
      <EnTetePage titre="Modifier le fournisseur" sousTitre={requete.donnees?.nom} />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du fournisseur…">
        {(fournisseur) => (
          <CoordonneesFormulaire
            tiers={fournisseur}
            retour={`${base}/${id}`}
            onEnregistrer={async (donnees) => {
              await fournisseurService.modifier(id, donnees);
              navigate(`${base}/${id}`, { state: { message: 'Modifications enregistrées.' } });
            }}
          />
        )}
      </BlocRequete>
    </section>
  );
}

/** /:activite/fournisseurs/:id : coordonnées, archivage et achats du fournisseur dans l'activité ouverte. */
export function FournisseurPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const base = useBase();
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const requete = useRequete((signal) => fournisseurService.consulter(id, signal), [id]);
  const achats = useAchatsFournisseur(profil, activite, id);
  const fournisseur = requete.donnees;
  const consulteAchats = possedePermission(profil, 'achats');
  return (
    <section className="page-etroite">
      <EnTetePage
        retour={{ to: base, libelle: 'Retour aux fournisseurs' }}
        titre={fournisseur?.nom ?? 'Fournisseur'}
        actions={
          fournisseur && (
            <>
              {consulteAchats && possedePermission(profil, 'achats', 'saisie') && fournisseur.actif && (
                <Link to={`/${activite}/achats/nouveau?fournisseur_id=${id}`} className="bouton bouton--secondaire">
                  Saisir un achat
                </Link>
              )}
              {possedePermission(profil, 'fournisseurs', 'saisie') && (
                <>
                  <Link to={`${base}/${id}/modifier`} className="bouton bouton--secondaire">
                    Modifier
                  </Link>
                  <BoutonArchivage
                    actif={fournisseur.actif}
                    nature="ce fournisseur"
                    consequence="Il ne sera plus proposé pour les nouveaux achats ; ses achats restent consultables."
                    onBasculer={async (actif) => {
                      await fournisseurService.modifier(id, { actif });
                      setMessage(actif ? 'Fournisseur réactivé.' : 'Fournisseur archivé.');
                      requete.recharger();
                    }}
                  />
                </>
              )}
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du fournisseur…">
        {(fiche) => (
          <>
            <FicheDonnees
              lignes={[
                ['Nom', fiche.nom],
                ['Téléphone', fiche.telephone],
                ['Adresse', fiche.adresse],
                ['État', <PastilleStatut key="etat" libelle={fiche.actif ? 'Actif' : 'Archivé'} ton={fiche.actif ? 'succes' : 'neutre'} />],
                ['Modifié le', formaterDate(fiche.updated_at)],
              ]}
            />
            {consulteAchats && (
              <div className="section-fiche panneau">
                <h2 className="panneau__titre">Achats de cette activité</h2>
                {achats.length === 0 ? (
                  <p className="texte-doux">Aucun achat visible pour ce fournisseur dans cette activité.</p>
                ) : (
                  <table className="tableau">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col" className="nombre">Total</th>
                        <th scope="col" className="nombre">Solde</th>
                        <th scope="col">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {achats.map((achat) => (
                        <tr key={achat._id}>
                          <th scope="row">
                            <Link to={`/${activite}/achats/${achat._id}`}>{formaterDate(achat.date_achat)}</Link>
                          </th>
                          <td className="nombre">{formaterMontant(achat.montant_total)}</td>
                          <td className="nombre">{formaterMontant(achat.solde_restant)}</td>
                          <td>
                            <PastilleStatut {...STATUTS_PRODUCTION[achat.statut]} />
                            {achat.statut_reception && <> <PastilleStatut {...STATUTS_RECEPTION[achat.statut_reception]} /></>}
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
