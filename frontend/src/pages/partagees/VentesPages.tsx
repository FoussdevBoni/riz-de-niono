import ActionGroupee from '../../components/ActionGroupee';
import { actionTransactionAutorisee, optionsTransaction } from '../../components/ActionsTransaction';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
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
import { optionsClients, useClientsReference } from '../../modules/commercialisation/clients/hooks/useClientsReference';
import { OPTIONS_STATUT_PRODUCTION, STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';
import { useStocksDisponibles } from '../../modules/stock/hooks/useStocksDisponibles';
import { VenteFormulaire } from '../../modules/ventes/components/VenteFormulaire';
import { venteService } from '../../modules/ventes/services/venteService';
import type { ActiviteVente, DonneesVente } from '../../modules/ventes/types/venteTypes';
import { estNul, formaterDate, formaterMontant } from '../../utils/formatage';

const FILTRES = ['client_id', 'statut', 'page'] as const;

/** Espace de la page : ventes en production et en commercialisation seulement (document 05). */
function useActiviteVente(): ActiviteVente {
  const activite = useActiviteCourante();
  return activite === 'production' ? 'production' : 'commercialisation';
}

/** /:activite/ventes : ventes de l'activité ouverte, filtres client et statut, avec solde et trop-perçu. */
export function VentesPage() {
  const { profil } = useSession();
  const activite = useActiviteVente();
  const base = `/${activite}/ventes`;
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete(
    (signal) => venteService.lister({ activite, client_id: filtres.client_id, statut: filtres.statut, page, taille_page: 25 }, signal),
    [activite, filtres.client_id, filtres.statut, page],
  );
  const clients = optionsClients(useClientsReference(profil));
  const filtre = Boolean(filtres.client_id || filtres.statut);
  return (
    <section>
      <EnTetePage
        titre="Ventes"
        sousTitre={
          activite === 'production'
            ? 'Ventes directes de la production : lignes, prix, paiements et solde.'
            : 'Ventes de commandes livrées et ventes directes : lignes, prix, paiements et solde.'
        }
        actions={
          possedePermission(profil, 'ventes', 'saisie') && (
            <Link to={`${base}/nouveau${filtres.client_id ? `?client_id=${filtres.client_id}` : ''}`} className="bouton">
              Vente directe
            </Link>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des ventes">
        {clients.length > 0 && (
          <SelectFiltre libelle="Client" libelleTous="Tous les clients" valeur={filtres.client_id ?? ''} options={clients} onChange={(valeur) => definir('client_id', valeur)} />
        )}
        <SelectFiltre libelle="Statut" libelleTous="Tous les statuts" valeur={filtres.statut ?? ''} options={OPTIONS_STATUT_PRODUCTION} onChange={(valeur) => definir('statut', valeur)} />
        {filtre && (
          <button type="button" className="bouton bouton--fantome-sombre" onClick={reinitialiser}>
            Effacer les filtres
          </button>
        )}
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des ventes…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucune vente">
              <p>{filtre ? 'Aucune vente ne correspond à ces filtres.' : 'Les ventes de cette activité apparaîtront ici.'}</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionGroupee
                items={resultats.items}
                eligible={(ligne) => actionTransactionAutorisee('annuler', possedePermission(profil, 'ventes', 'validation'), 'ventes', ligne)}
                nom={(ligne) => `Vente du ${formaterDate(ligne.date_vente)}`}
                action="Annuler les lignes"
                titre="Confirmer l’annulation"
                motif
                executer={venteService.annuler}
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
                          <th scope="col">Origine</th>
                          <th scope="col" className="nombre">Total</th>
                          <th scope="col" className="nombre">Encaissé</th>
                          <th scope="col" className="nombre">Solde</th>
                          <th scope="col">Statut</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((vente) => (
                          <TableRow
                            key={vente._id}
                            selection={caseLigne(vente)}
                            actions={
                              <ActionsFiche
                                to={`${base}/${vente._id}`}
                                autres={optionsTransaction(`${base}/${vente._id}`, possedePermission(profil, 'ventes', 'validation'), 'ventes', vente)}
                                modifier={vente.statut === 'brouillon' && vente.commande_id === null && possedePermission(profil, 'ventes', 'saisie')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${base}/${vente._id}`}>{formaterDate(vente.date_vente)}</Link>
                            </th>
                            <td>{libelleReference(clients, vente.client_id, 'Nom du client indisponible')}</td>
                            <td>{vente.commande_id ? 'Commande livrée' : 'Vente directe'}</td>
                            <td className="nombre">{formaterMontant(vente.montant_total)}</td>
                            <td className="nombre">{formaterMontant(vente.montant_encaisse)}</td>
                            <td className="nombre">{estNul(vente.trop_percu) ? formaterMontant(vente.solde) : `Trop-perçu ${formaterMontant(vente.trop_percu)}`}</td>
                            <td>
                              <PastilleStatut {...STATUTS_PRODUCTION[vente.statut]} />
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

/** Enregistre puis, si demandé, valide ; un refus de validation réutilise ensuite le même brouillon. */
function useEnregistrement(base: string, idExistant?: string) {
  const navigate = useNavigationEdition();
  const idCree = useRef<string | null>(idExistant ?? null);
  return async (donnees: DonneesVente, valider: boolean) => {
    let id = idCree.current;
    if (id) {
      const { activite: _activite, ...modifiables } = donnees;
      await venteService.modifier(id, modifiables);
    } else {
      id = (await venteService.creer(donnees))._id;
      idCree.current = id;
    }
    if (valider) await venteService.valider(id);
    navigate(`${base}/${id}`, { state: { message: valider ? 'Vente validée : les produits sont sortis du stock.' : 'Vente enregistrée en brouillon.' } });
  };
}

function useReferencesVente(activite: ActiviteVente) {
  const { profil } = useSession();
  return {
    clients: useClientsReference(profil),
    produits: useProduitsReference(profil, activite),
    stocks: useStocksDisponibles(possedePermission(profil, 'stock')),
    peutValider: possedePermission(profil, 'ventes', 'validation'),
  };
}

/** /:activite/ventes/nouveau : vente directe de l'activité ouverte (les ventes de commande naissent à la livraison). */
export function VenteNouveauPage() {
  const activite = useActiviteVente();
  const base = `/${activite}/ventes`;
  const [parametres] = useSearchParams();
  const references = useReferencesVente(activite);
  const enregistrer = useEnregistrement(base);
  return (
    <section>
      <EnTetePage titre="Vente directe" sousTitre="La vente est créée en brouillon ; sa validation sort les produits du stock." />
      <VenteFormulaire {...references} activite={activite} clientInitial={parametres.get('client_id') ?? undefined} retour={base} onEnregistrer={enregistrer} />
    </section>
  );
}

/** /:activite/ventes/:id/modifier : seul le brouillon d'une vente directe se modifie. */
export function VenteModifierPage() {
  const { id = '' } = useParams();
  const activite = useActiviteVente();
  const base = `/${activite}/ventes`;
  const requete = useRequete((signal) => venteService.consulter(id, signal), [id]);
  const references = useReferencesVente(requete.donnees?.activite ?? activite);
  const enregistrer = useEnregistrement(base, id);
  return (
    <section>
      <EnTetePage titre="Modifier la vente" />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de la vente…">
        {(vente) =>
          vente.statut !== 'brouillon' ? (
            <Alerte ton="attention" titre="Vente non modifiable">
              <p>Seul le brouillon d’une vente directe se modifie. Une vente validée se corrige par un retour client ou, pour une vente directe, par annulation.</p>
              <Link to={`${base}/${id}`}>Retour à la fiche</Link>
            </Alerte>
          ) : (
            <VenteFormulaire {...references} vente={vente} activite={vente.activite} retour={`${base}/${id}`} onEnregistrer={enregistrer} />
          )
        }
      </BlocRequete>
    </section>
  );
}
