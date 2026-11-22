import ActionsArchivage from '../../components/ActionsArchivage';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { ArrowRight } from 'lucide-react';
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
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { useMessageNavigation } from '../../hooks/useMessageNavigation';
import { useRequete } from '../../hooks/useRequete';
import { useEspaceVente } from '../../modules/ventes/hooks/useEspaceVente';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedeActivite, possedePermission } from '../../modules/authentification/utils/permissions';
import { clientService } from '../../modules/commercialisation/clients/services/clientService';
import { STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { LIBELLES_ACTIVITES } from '../../modules/produits/utils/libellesProduits';
import { SituationVenteCartes } from '../../modules/ventes/components/SituationVenteCartes';
import { useVentesClient } from '../../modules/ventes/hooks/useVentes';
import { pageCommerciale } from '../../modules/ventes/utils/accesCommercial';
import { formaterDate, formaterMontant } from '../../utils/formatage';

/** Base des pages dans l'espace de vente ouvert (/production/clients ou /commercialisation/clients). */
function useBase() {
  return `/${useEspaceVente()}/clients`;
}
const FILTRES = ['actif', 'page'] as const;
const OPTIONS_ETAT = [
  { valeur: 'true', libelle: 'Actifs' },
  { valeur: 'false', libelle: 'Archivés' },
];

/** /:activite/clients : clients, filtre actif. */
export function ClientsPage() {
  const BASE = useBase();
  const { profil } = useSession();
  const { filtres, definir } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete((signal) => clientService.lister({ actif: filtres.actif, page, taille_page: 25 }, signal), [filtres.actif, page]);
  return (
    <section>
      <EnTetePage
        titre="Clients"
        sousTitre="Coordonnées et accès aux commandes, ventes et règlements."
        actions={
          possedePermission(profil, 'clients', 'saisie') && (
            <CreationListe
              titre="Nouveau client"
              base={BASE}
              message="Client créé."
              creer={clientService.creer}
              actualiser={requete.recharger}
            >
              {({ annuler, enregistrer }) => (
                <CoordonneesFormulaire
                  retour={BASE}
                  onAnnuler={annuler}
                  onEnregistrer={enregistrer}
                />
              )}
            </CreationListe>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des clients">
        <SelectFiltre libelle="État" libelleTous="Tous les clients" valeur={filtres.actif ?? ''} options={OPTIONS_ETAT} onChange={(valeur) => definir('actif', valeur)} />
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des clients…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucun client">
              <p>{filtres.actif ? 'Aucun client ne correspond à ce filtre.' : 'Les clients enregistrés apparaîtront ici.'}</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionsArchivage
                items={resultats.items}
                autorise={possedePermission(profil, 'clients', 'saisie')}
                modifier={(id, actif) => clientService.modifier(id, { actif })}
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
                        {resultats.items.map((client) => (
                          <TableRow key={client._id} selection={caseLigne(client)} actions={<ActionsFiche autres={menu(client)} to={`${BASE}/${client._id}`} />}>
                            <th scope="row">
                              <Link to={`${BASE}/${client._id}`}>{client.nom}</Link>
                            </th>
                            <td>{client.telephone ?? '—'}</td>
                            <td>{client.adresse ?? '—'}</td>
                            <td>
                              <PastilleStatut libelle={client.actif ? 'Actif' : 'Archivé'} ton={client.actif ? 'succes' : 'neutre'} />
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

export function ClientNouveauPage() {
  const BASE = useBase();
  const navigate = useNavigationEdition();
  return (
    <section className="page-etroite">
      <EnTetePage titre="Nouveau client" />
      <CoordonneesFormulaire
        retour={BASE}
        onEnregistrer={async (donnees) => {
          const client = await clientService.creer(donnees);
          navigate(`${BASE}/${client._id}`, { state: { message: 'Client créé.' } });
        }}
      />
    </section>
  );
}

export function ClientModifierPage() {
  const BASE = useBase();
  const { id = '' } = useParams();
  const navigate = useNavigationEdition();
  const requete = useRequete((signal) => clientService.consulter(id, signal), [id]);
  return (
    <section className="page-etroite">
      <EnTetePage titre="Modifier le client" sousTitre={requete.donnees?.nom} />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du client…">
        {(client) => (
          <CoordonneesFormulaire
            tiers={client}
            retour={`${BASE}/${id}`}
            onEnregistrer={async (donnees) => {
              await clientService.modifier(id, donnees);
              navigate(`${BASE}/${id}`, { state: { message: 'Modifications enregistrées.' } });
            }}
          />
        )}
      </BlocRequete>
    </section>
  );
}

/**
 * /:activite/clients/:id : coordonnées, situation cumulée des ventes validées visibles (API),
 * dernières ventes et accès aux ventes, commandes et nouvelles saisies du client.
 */
export function ClientPage() {
  const BASE = useBase();
  const { id = '' } = useParams();
  const { profil } = useSession();
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const requete = useRequete((signal) => clientService.consulter(id, signal), [id]);
  const ventes = useVentesClient(profil, id);
  const client = requete.donnees;
  const consulteVentes = possedePermission(profil, 'ventes');
  // Les ventes d'un client s'ouvrent dans l'espace de leur activité (production ou commercialisation).
  const espaceVente = (activite: string) => (possedeActivite(profil, activite as 'production') ? activite : 'commercialisation');
  return (
    <section>
      <EnTetePage
        retour={{ to: BASE, libelle: 'Retour aux clients' }}
        titre={client?.nom ?? 'Client'}
        actions={
          client && (
            <>
              {client.actif && pageCommerciale(profil, 'commandes_clients', 'saisie') && (
                <Link to={`/commercialisation/commandes-clients/nouveau?client_id=${id}`} className="bouton bouton--secondaire">
                  Nouvelle commande
                </Link>
              )}
              {client.actif && possedePermission(profil, 'ventes', 'saisie') && (
                <Link to={`${BASE.replace('/clients', '')}/ventes/nouveau?client_id=${id}`} className="bouton bouton--secondaire">
                  Vente directe
                </Link>
              )}
              {possedePermission(profil, 'clients', 'saisie') && (
                <>
                  <Link to={`${BASE}/${id}/modifier`} className="bouton bouton--secondaire">
                    Modifier
                  </Link>
                  <BoutonArchivage
                    actif={client.actif}
                    nature="ce client"
                    consequence="Il ne sera plus proposé pour les nouvelles commandes et ventes ; son historique reste consultable."
                    onBasculer={async (actif) => {
                      await clientService.modifier(id, { actif });
                      setMessage(actif ? 'Client réactivé.' : 'Client archivé.');
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
      <BlocRequete {...requete} cartes={4} libelleChargement="Chargement du client…">
        {(fiche) => (
          <>
            <SituationVenteCartes situation={fiche.ventes} precisionTotal="Ventes validées visibles" />
            <div className="page-etroite">
              <FicheDonnees
                lignes={[
                  ['Nom', fiche.nom],
                  ['Téléphone', fiche.telephone],
                  ['Adresse', fiche.adresse],
                  ['État', <PastilleStatut key="etat" libelle={fiche.actif ? 'Actif' : 'Archivé'} ton={fiche.actif ? 'succes' : 'neutre'} />],
                ]}
              />
            </div>
            {consulteVentes && (
              <div className="section-fiche panneau">
                <h2 className="panneau__titre">Dernières ventes</h2>
                {ventes.length === 0 ? (
                  <p className="texte-doux">Aucune vente visible pour ce client.</p>
                ) : (
                  <table className="tableau">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Activité</th>
                        <th scope="col" className="nombre">Total</th>
                        <th scope="col" className="nombre">Solde</th>
                        <th scope="col">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ventes.map((vente) => (
                        <tr key={vente._id}>
                          <th scope="row">
                            <Link to={`/${espaceVente(vente.activite)}/ventes/${vente._id}`}>{formaterDate(vente.date_vente)}</Link>
                          </th>
                          <td>{LIBELLES_ACTIVITES[vente.activite]}</td>
                          <td className="nombre">{formaterMontant(vente.montant_total)}</td>
                          <td className="nombre">{Number(vente.trop_percu) > 0 ? `Trop-perçu ${formaterMontant(vente.trop_percu)}` : formaterMontant(vente.solde)}</td>
                          <td>
                            <PastilleStatut {...STATUTS_PRODUCTION[vente.statut]} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p>
                  <Link to={`${BASE.replace('/clients', '')}/ventes?client_id=${fiche._id}`} className="lien-avec-icone">Ses ventes dans cette activité <ArrowRight size={16} aria-hidden="true" /></Link>
                  {pageCommerciale(profil, 'commandes_clients') && (
                    <>
                      {' · '}
                      <Link to={`/commercialisation/commandes-clients?client_id=${fiche._id}`} className="lien-avec-icone">Ses commandes <ArrowRight size={16} aria-hidden="true" /></Link>
                    </>
                  )}
                </p>
              </div>
            )}
          </>
        )}
      </BlocRequete>
    </section>
  );
}
