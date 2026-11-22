import ActionGroupee from '../../components/ActionGroupee';
import { actionTransactionAutorisee, optionsTransaction } from '../../components/ActionsTransaction';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { Link, useParams, useSearchParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
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
import { optionsClients, useClientsReference } from '../../modules/commercialisation/clients/hooks/useClientsReference';
import { CommandeClientFormulaire } from '../../modules/commercialisation/commandes-clients/components/CommandeClientFormulaire';
import { commandeClientService } from '../../modules/commercialisation/commandes-clients/services/commandeClientService';
import { OPTIONS_STATUT_COMMANDE, STATUTS_COMMANDE } from '../../modules/commercialisation/commandes-clients/utils/statutCommande';
import { useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';
import { useStocksDisponibles } from '../../modules/stock/hooks/useStocksDisponibles';
import { formaterDate, formaterMontant } from '../../utils/formatage';

const BASE = '/commercialisation/commandes-clients';
const FILTRES = ['client_id', 'statut', 'page'] as const;

/** /commercialisation/commandes-clients : commandes, filtres client et statut. */
export function CommandesClientsPage() {
  const { profil } = useSession();
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete(
    (signal) => commandeClientService.lister({ client_id: filtres.client_id, statut: filtres.statut, page, taille_page: 25 }, signal),
    [filtres.client_id, filtres.statut, page],
  );
  const clients = optionsClients(useClientsReference(profil));
  const filtre = Boolean(filtres.client_id || filtres.statut);
  return (
    <section>
      <EnTetePage
        titre="Commandes clients"
        sousTitre="Client, lignes, prix et statut ; la livraison crée la vente."
        actions={
          possedePermission(profil, 'commandes_clients', 'saisie') && (
            <Link to={`${BASE}/nouveau${filtres.client_id ? `?client_id=${filtres.client_id}` : ''}`} className="bouton">
              Nouvelle commande
            </Link>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des commandes">
        {clients.length > 0 && (
          <SelectFiltre libelle="Client" libelleTous="Tous les clients" valeur={filtres.client_id ?? ''} options={clients} onChange={(valeur) => definir('client_id', valeur)} />
        )}
        <SelectFiltre libelle="Statut" libelleTous="Tous les statuts" valeur={filtres.statut ?? ''} options={OPTIONS_STATUT_COMMANDE} onChange={(valeur) => definir('statut', valeur)} />
        {filtre && (
          <button type="button" className="bouton bouton--fantome-sombre" onClick={reinitialiser}>
            Effacer les filtres
          </button>
        )}
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des commandes…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucune commande">
              <p>{filtre ? 'Aucune commande ne correspond à ces filtres.' : 'Les commandes clients saisies apparaîtront ici.'}</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionGroupee
                items={resultats.items}
                eligible={(ligne) => actionTransactionAutorisee('annuler', possedePermission(profil, 'commandes_clients', 'validation'), 'commandes', ligne)}
                nom={(ligne) => `Commande du ${formaterDate(ligne.date_commande)}`}
                action="Annuler les lignes"
                titre="Confirmer l’annulation"
                motif="facultatif"
                executer={commandeClientService.annuler}
                actualiser={requete.recharger}
              >
                {({ entete, caseLigne }) => (
                  <div className="tableau-defilant">
                    <table className="tableau">
                      <thead>
                        <tr>
                          {entete && <th scope="col" className="colonne-selection">{entete}</th>}
                          <th scope="col">Date</th>
                          <th scope="col">Client</th>
                          <th scope="col" className="nombre">Montant</th>
                          <th scope="col">Statut</th>
                          <th scope="col">Vente</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((commande) => (
                          <TableRow
                            key={commande._id}
                            selection={caseLigne(commande)}
                            actions={
                              <ActionsFiche
                                to={`${BASE}/${commande._id}`}
                                autres={optionsTransaction(`${BASE}/${commande._id}`, possedePermission(profil, 'commandes_clients', 'validation'), 'commandes', commande)}
                                modifier={commande.statut === 'en_cours' && possedePermission(profil, 'commandes_clients', 'saisie')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${BASE}/${commande._id}`}>{formaterDate(commande.date_commande)}</Link>
                            </th>
                            <td>{libelleReference(clients, commande.client_id, 'Nom du client indisponible')}</td>
                            <td className="nombre">{formaterMontant(commande.montant_total)}</td>
                            <td>
                              <PastilleStatut {...STATUTS_COMMANDE[commande.statut]} />
                            </td>
                            <td>{commande.vente_id ? <Link to={`/commercialisation/ventes/${commande.vente_id}`}>Voir la vente</Link> : '—'}</td>
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

function useReferencesCommande() {
  const { profil } = useSession();
  return {
    clients: useClientsReference(profil),
    produits: useProduitsReference(profil, 'commercialisation'),
    stocks: useStocksDisponibles(possedePermission(profil, 'stock')),
  };
}

export function CommandeClientNouveauPage() {
  const navigate = useNavigationEdition();
  const [parametres] = useSearchParams();
  const references = useReferencesCommande();
  return (
    <section>
      <EnTetePage titre="Nouvelle commande client" sousTitre="La commande s’expédie puis se livre depuis sa fiche ; la livraison crée la vente et sort le stock." />
      <CommandeClientFormulaire
        {...references}
        clientInitial={parametres.get('client_id') ?? undefined}
        retour={BASE}
        onEnregistrer={async (donnees) => {
          const commande = await commandeClientService.creer(donnees);
          navigate(`${BASE}/${commande._id}`, { state: { message: 'Commande enregistrée.' } });
        }}
      />
    </section>
  );
}

/** /commercialisation/commandes-clients/:id/modifier : seule une commande en cours se modifie. */
export function CommandeClientModifierPage() {
  const { id = '' } = useParams();
  const navigate = useNavigationEdition();
  const requete = useRequete((signal) => commandeClientService.consulter(id, signal), [id]);
  const references = useReferencesCommande();
  return (
    <section>
      <EnTetePage titre="Modifier la commande" />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de la commande…">
        {(commande) =>
          commande.statut !== 'en_cours' ? (
            <Alerte ton="attention" titre="Commande non modifiable">
              <p>Seule une commande en cours se modifie.</p>
              <Link to={`${BASE}/${id}`}>Retour à la fiche</Link>
            </Alerte>
          ) : (
            <CommandeClientFormulaire
              {...references}
              commande={commande}
              retour={`${BASE}/${id}`}
              onEnregistrer={async (donnees) => {
                await commandeClientService.modifier(id, donnees);
                navigate(`${BASE}/${id}`, { state: { message: 'Commande mise à jour.' } });
              }}
            />
          )
        }
      </BlocRequete>
    </section>
  );
}
