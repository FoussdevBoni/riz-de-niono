import ActionGroupee from '../../components/ActionGroupee';
import { actionTransactionAutorisee, optionsTransaction, useActionListe } from '../../components/ActionsTransaction';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { DialogueAction } from '../../components/DialogueAction';
import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';
import { FicheDonnees } from '../../components/FicheDonnees';
import { Pagination } from '../../components/Pagination';
import { PastilleStatut } from '../../components/PastilleStatut';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { useMessageNavigation } from '../../hooks/useMessageNavigation';
import { libelleReference } from '../../hooks/useOptionsReference';
import { useRequete } from '../../hooks/useRequete';
import { useEspaceVente } from '../../modules/ventes/hooks/useEspaceVente';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { optionsClients, useClientsReference } from '../../modules/commercialisation/clients/hooks/useClientsReference';
import { RetourClientFormulaire } from '../../modules/commercialisation/retours-clients/components/RetourClientFormulaire';
import { retourClientService } from '../../modules/commercialisation/retours-clients/services/retourClientService';
import type { DonneesRetourClient } from '../../modules/commercialisation/retours-clients/types/retourClientTypes';
import { STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';
import { LIBELLES_ACTIVITES } from '../../modules/produits/utils/libellesProduits';
import { useMouvementsOrigine } from '../../modules/stock/hooks/useMouvementsOrigine';
import { LIBELLES_SENS } from '../../modules/stock/utils/libellesStock';
import { messageStockInsuffisant } from '../../modules/stock/utils/messageStock';
import { SituationVenteCartes } from '../../modules/ventes/components/SituationVenteCartes';
import { useVentesValidees } from '../../modules/ventes/hooks/useVentes';
import { venteService } from '../../modules/ventes/services/venteService';
import type { Vente } from '../../modules/ventes/types/venteTypes';
import { espaceVente } from '../../modules/ventes/utils/accesCommercial';
import { formaterDate, formaterMontant, formaterNombre, formaterQuantite } from '../../utils/formatage';

/** Base des pages dans l'espace de vente ouvert (/production/retours-clients ou /commercialisation/retours-clients). */
function useBase() {
  return `/${useEspaceVente()}/retours-clients`;
}
const FILTRES = ['vente_id', 'page'] as const;

function useLibelleVente() {
  const { profil } = useSession();
  const clients = optionsClients(useClientsReference(profil));
  return (vente: Vente) => `${libelleReference(clients, vente.client_id, 'Nom du client indisponible')} · ${formaterDate(vente.date_vente)} · ${formaterMontant(vente.montant_total)}`;
}

/** /:activite/retours-clients : retours visibles, filtre vente_id. */
export function RetoursClientsPage() {
  const BASE = useBase();
  const { profil } = useSession();
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const activite = useEspaceVente();
  // Le filtre activite se combine avec vente_id depuis la fiche d'une vente.
  const requete = useRequete(
    (signal) => retourClientService.lister({ activite, vente_id: filtres.vente_id, page, taille_page: 25 }, signal),
    [activite, filtres.vente_id, page],
  );
  const produits = useProduitsReference(profil);
  const produit = (id: string) => produits.find((element) => element._id === id);
  return (
    <section>
      <EnTetePage
        titre="Retours clients"
        sousTitre="Vente, lignes retournées, motif et quantité revendable des retours de cette activité."
        actions={
          possedePermission(profil, 'retours_clients', 'saisie') && (
            <Link to={`${BASE}/nouveau${filtres.vente_id ? `?vente_id=${filtres.vente_id}` : ''}`} className="bouton">
              Nouveau retour
            </Link>
          )
        }
      />
      {filtres.vente_id && (
        <div className="barre-filtres">
          <p className="texte-doux">Retours d’une vente.</p>
          <button type="button" className="bouton bouton--fantome-sombre" onClick={reinitialiser}>
            Tous les retours
          </button>
        </div>
      )}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des retours…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucun retour">
              <p>Les retours se saisissent depuis la fiche d’une vente validée ou avec « Nouveau retour ».</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionGroupee
                items={resultats.items}
                eligible={(ligne) => actionTransactionAutorisee('annuler', possedePermission(profil, 'retours_clients', 'validation'), 'standard', ligne)}
                nom={(ligne) => `Retour du ${formaterDate(ligne.date_retour)}`}
                action="Annuler les lignes"
                titre="Confirmer l’annulation"
                motif
                executer={retourClientService.annuler}
                actualiser={requete.recharger}
              >
                {({ entete, caseLigne }) => (
                  <div className="tableau-defilant">
                    <table className="tableau">
                      <thead>
                        <tr>
                          {entete && <th scope="col" className="colonne-selection">{entete}</th>}
                          <th scope="col">Date</th>
                          <th scope="col">Activité</th>
                          <th scope="col">Produits</th>
                          <th scope="col" className="nombre">Montant</th>
                          <th scope="col">Statut</th>
                          <th scope="col">Vente</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((retour) => (
                          <TableRow
                            key={retour._id}
                            selection={caseLigne(retour)}
                            actions={
                              <ActionsFiche
                                to={`${BASE}/${retour._id}`}
                                autres={optionsTransaction(`${BASE}/${retour._id}`, possedePermission(profil, 'retours_clients', 'validation'), 'standard', retour)}
                                modifier={retour.statut === 'brouillon' && possedePermission(profil, 'retours_clients', 'saisie')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${BASE}/${retour._id}`}>{formaterDate(retour.date_retour)}</Link>
                            </th>
                            <td>{LIBELLES_ACTIVITES[retour.activite as 'production'] ?? retour.activite}</td>
                            <td>{retour.lignes.map((ligne) => `${produit(ligne.produit_id)?.nom ?? ligne.produit_nom ?? 'Produit hors catalogue'} ${formaterNombre(ligne.quantite)}`).join(' · ')}</td>
                            <td className="nombre">{formaterMontant(retour.montant)}</td>
                            <td>
                              <PastilleStatut {...STATUTS_PRODUCTION[retour.statut]} />
                            </td>
                            <td>
                              <button type="button" className="bouton bouton--fantome-sombre bouton--petit" onClick={() => definir('vente_id', retour.vente_id)}>
                                Voir ses retours
                              </button>
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

/** Enregistre puis, si demandé, valide ; après validation, la fiche de vente s'ouvre à jour. */
function useEnregistrement(produits: ReturnType<typeof useProduitsReference>, idExistant?: string) {
  const BASE = useBase();
  const navigate = useNavigationEdition();
  const { profil } = useSession();
  const idCree = useRef<string | null>(idExistant ?? null);
  return async (donnees: DonneesRetourClient, valider: boolean, vente: Vente | undefined) => {
    let id = idCree.current;
    if (id) {
      const { vente_id: _vente, ...modifiables } = donnees;
      await retourClientService.modifier(id, modifiables);
    } else {
      id = (await retourClientService.creer(donnees))._id;
      idCree.current = id;
    }
    if (valider) {
      try {
        await retourClientService.valider(id);
      } catch (cause) {
        const stock = messageStockInsuffisant(cause, produits, 'Le retour reste en brouillon.');
        if (stock) throw new Error(stock.message);
        throw cause;
      }
      if (vente) {
        navigate(`/${espaceVente(profil, vente.activite)}/ventes/${vente._id}`, { state: { message: 'Retour validé : la fiche de vente est à jour.' } });
        return;
      }
    }
    navigate(`${BASE}/${id}`, { state: { message: valider ? 'Retour validé.' : 'Retour enregistré en brouillon.' } });
  };
}

export function RetourClientNouveauPage() {
  const BASE = useBase();
  const { profil } = useSession();
  const [parametres] = useSearchParams();
  const ventes = useVentesValidees(profil, useEspaceVente()).filter((vente) => vente.lignes.some((ligne) => Number(ligne.quantite) > Number(ligne.quantite_retournee)));
  const produits = useProduitsReference(profil);
  const libelleVente = useLibelleVente();
  const enregistrer = useEnregistrement(produits);
  const venteInitiale = parametres.get('vente_id') ?? undefined;
  const venteChoisie = ventes.find((vente) => vente._id === venteInitiale);
  return (
    <section>
      <EnTetePage titre="Nouveau retour client" />
      <RetourClientFormulaire
        ventes={ventes}
        produits={produits}
        libelleVente={libelleVente}
        venteInitiale={venteInitiale}
        peutValider={possedePermission(profil, 'retours_clients', 'validation')}
        retourLien={venteChoisie ? `/${espaceVente(profil, venteChoisie.activite)}/ventes/${venteChoisie._id}` : BASE}
        onEnregistrer={enregistrer}
      />
    </section>
  );
}

/** /:activite/retours-clients/:id/modifier : seul un brouillon se modifie ; la vente ne change pas. */
export function RetourClientModifierPage() {
  const BASE = useBase();
  const { id = '' } = useParams();
  const { profil } = useSession();
  const requete = useRequete((signal) => retourClientService.consulter(id, signal), [id]);
  const vente = useRequete((signal) => (requete.donnees ? venteService.consulter(requete.donnees.vente_id, signal) : Promise.resolve(null)), [requete.donnees?.vente_id]).donnees;
  const produits = useProduitsReference(profil);
  const libelleVente = useLibelleVente();
  const enregistrer = useEnregistrement(produits, id);
  return (
    <section>
      <EnTetePage titre="Modifier le retour" />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du retour…">
        {(retour) =>
          retour.statut !== 'brouillon' ? (
            <Alerte ton="attention" titre="Retour non modifiable">
              <p>Seul un brouillon se modifie. Un retour validé se corrige par annulation avec motif.</p>
              <Link to={`${BASE}/${id}`}>Retour à la fiche</Link>
            </Alerte>
          ) : vente ? (
            <RetourClientFormulaire
              retour={retour}
              ventes={[vente]}
              produits={produits}
              libelleVente={libelleVente}
              peutValider={possedePermission(profil, 'retours_clients', 'validation')}
              retourLien={`${BASE}/${id}`}
              onEnregistrer={enregistrer}
            />
          ) : (
            <p className="texte-doux">Chargement de la vente…</p>
          )
        }
      </BlocRequete>
    </section>
  );
}

type Action = 'valider' | 'annuler';

/** /:activite/retours-clients/:id : lignes retournées, situation de la vente et mouvements de remise en stock. */
export function RetourClientPage() {
  const BASE = useBase();
  const { id = '' } = useParams();
  const { profil } = useSession();
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const actionListe = useActionListe<Action>(['valider', 'annuler']);
  const [action, setAction] = useState<Action | null>(actionListe);
  const requete = useRequete((signal) => retourClientService.consulter(id, signal), [id]);
  const retour = requete.donnees;
  const vente = useRequete((signal) => (retour ? venteService.consulter(retour.vente_id, signal) : Promise.resolve(null)), [retour?.vente_id, retour?.updated_at]).donnees;
  const produits = useProduitsReference(profil);
  const consulteStock = possedePermission(profil, 'stock');
  const mouvements = useMouvementsOrigine(retour?.validated_at ? { type: 'retour_client', id, version: retour.updated_at } : null, consulteStock);
  const peutValider = possedePermission(profil, 'retours_clients', 'validation');
  const produit = (produitId: string) => produits.find((element) => element._id === produitId);

  return (
    <section>
      <EnTetePage
        retour={{ to: retour ? `${BASE}?vente_id=${retour.vente_id}` : BASE, libelle: 'Retours de cette vente' }}
        titre={retour ? `Retour de ${formaterMontant(retour.montant)}` : 'Retour client'}
        sousTitre={retour ? formaterDate(retour.date_retour) : undefined}
        actions={
          retour && (
            <>
              {retour.statut === 'brouillon' && possedePermission(profil, 'retours_clients', 'saisie') && (
                <Link to={`${BASE}/${id}/modifier`} className="bouton bouton--secondaire">
                  Modifier
                </Link>
              )}
              {retour.statut === 'brouillon' && peutValider && (
                <button type="button" className="bouton" onClick={() => setAction('valider')}>
                  Valider
                </button>
              )}
              {retour.statut !== 'annulee' && peutValider && (
                <button type="button" className="bouton bouton--danger" onClick={() => setAction('annuler')}>
                  Annuler
                </button>
              )}
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      <BlocRequete {...requete} cartes={4} libelleChargement="Chargement du retour…">
        {(fiche) => (
          <>
            <SituationVenteCartes situation={fiche.vente} precisionTotal="Vente concernée" />
            <div className="page-etroite">
              <FicheDonnees
                lignes={[
                  ['Statut', <PastilleStatut key="statut" {...STATUTS_PRODUCTION[fiche.statut]} />],
                  ['Vente', vente ? <Link key="vente" to={`/${espaceVente(profil, vente.activite)}/ventes/${vente._id}`}>Ouvrir la fiche de la vente</Link> : 'Vente indisponible'],
                  ['Montant du retour', formaterMontant(fiche.montant)],
                  ['Validé le', fiche.validated_at ? formaterDate(fiche.validated_at) : null],
                  ['Annulé le', fiche.annulee_at ? formaterDate(fiche.annulee_at) : null],
                  ['Motif d’annulation', fiche.motif_annulation],
                ]}
              />
            </div>
            <div className="section-fiche panneau">
              <h2 className="panneau__titre">Lignes retournées</h2>
              <div className="tableau-defilant">
                <table className="tableau">
                  <thead>
                    <tr>
                      <th scope="col">Produit</th>
                      <th scope="col" className="nombre">Retournée</th>
                      <th scope="col" className="nombre">Revendable</th>
                      <th scope="col" className="nombre">Prix</th>
                      <th scope="col" className="nombre">Montant</th>
                      <th scope="col">Motif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiche.lignes.map((ligne) => (
                      <tr key={ligne.ligne_id}>
                        <th scope="row">{produit(ligne.produit_id)?.nom ?? ligne.produit_nom ?? 'Produit hors catalogue'}</th>
                        <td className="nombre">{formaterQuantite(ligne.quantite, produit(ligne.produit_id)?.unite_stock)}</td>
                        <td className="nombre">{formaterQuantite(ligne.quantite_revendable, produit(ligne.produit_id)?.unite_stock)}</td>
                        <td className="nombre">{formaterMontant(ligne.prix_unitaire)}</td>
                        <td className="nombre">{formaterMontant(ligne.montant)}</td>
                        <td>{ligne.motif}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {fiche.validated_at && consulteStock && (
              <div className="section-fiche panneau">
                <h2 className="panneau__titre">Mouvements de stock</h2>
                {mouvements.length === 0 ? (
                  <p className="texte-doux">Aucune remise en stock (aucune quantité revendable).</p>
                ) : (
                  <table className="tableau">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Produit</th>
                        <th scope="col">Sens</th>
                        <th scope="col" className="nombre">Quantité</th>
                        <th scope="col">Nature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mouvements.map((mouvement) => (
                        <tr key={mouvement._id}>
                          <th scope="row">
                            <Link to={`${BASE.replace('/retours-clients', '')}/mouvements-stock/${mouvement._id}`}>{formaterDate(mouvement.date_mouvement)}</Link>
                          </th>
                          <td>{produit(mouvement.produit_id)?.nom ?? mouvement.produit_nom ?? 'Produit hors catalogue'}</td>
                          <td className={mouvement.sens}>{LIBELLES_SENS[mouvement.sens]}</td>
                          <td className="nombre">{formaterQuantite(mouvement.quantite, produit(mouvement.produit_id)?.unite_stock)}</td>
                          <td>{mouvement.annule_mouvement_id ? 'Contre-écriture (annulation)' : 'Remise en stock du revendable'}</td>
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
      {action && retour && actionTransactionAutorisee(action, peutValider, 'standard', retour) && (
        <DialogueAction
          titre={action === 'valider' ? 'Valider le retour ?' : 'Annuler le retour ?'}
          libelleConfirmer={action === 'valider' ? 'Valider' : 'Annuler le retour'}
          danger={action === 'annuler'}
          motif={action === 'annuler'}
          onFermer={() => setAction(null)}
          onConfirmer={async (motif) => {
            try {
              if (action === 'valider') await retourClientService.valider(id);
              else await retourClientService.annuler(id, motif);
            } catch (cause) {
              const stock = messageStockInsuffisant(cause, produits, 'Le retour n’a pas changé.');
              if (stock) throw new Error(stock.message);
              throw cause;
            }
            setAction(null);
            setMessage(action === 'valider' ? 'Retour validé : le montant est déduit du dû et le revendable est remis en stock.' : 'Retour annulé.');
            requete.recharger();
          }}
        >
          <p>
            {action === 'valider'
              ? `${formaterMontant(retour.montant)} seront déduits du dû de la vente et la quantité revendable reviendra en stock.`
              : retour.statut === 'validee'
                ? 'Le retour reste dans l’historique ; la quantité revendable ressort du stock si elle est encore disponible.'
                : 'Le brouillon sera annulé et restera dans l’historique.'}
          </p>
        </DialogueAction>
      )}
    </section>
  );
}
