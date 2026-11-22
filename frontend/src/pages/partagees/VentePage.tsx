import { actionTransactionAutorisee, useActionListe } from '../../components/ActionsTransaction';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { DialogueAction } from '../../components/DialogueAction';
import { EnTetePage } from '../../components/EnTetePage';
import { FicheDonnees } from '../../components/FicheDonnees';
import { PastilleStatut } from '../../components/PastilleStatut';
import { useMessageNavigation } from '../../hooks/useMessageNavigation';
import { libelleReference } from '../../hooks/useOptionsReference';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { optionsClients, useClientsReference } from '../../modules/commercialisation/clients/hooks/useClientsReference';
import { useEncaissementsVente } from '../../modules/commercialisation/encaissements/hooks/useEncaissementsVente';
import { useRetoursVente } from '../../modules/commercialisation/retours-clients/hooks/useRetoursVente';
import { STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';
import { LIBELLES_ACTIVITES } from '../../modules/produits/utils/libellesProduits';
import { LIBELLES_MODES } from '../../modules/reglements-fournisseurs/utils/libellesReglements';
import { useMouvementsOrigine } from '../../modules/stock/hooks/useMouvementsOrigine';
import { LIBELLES_SENS } from '../../modules/stock/utils/libellesStock';
import { messageStockInsuffisant } from '../../modules/stock/utils/messageStock';
import { SituationVenteCartes } from '../../modules/ventes/components/SituationVenteCartes';
import { useEspaceVente } from '../../modules/ventes/hooks/useEspaceVente';
import { venteService } from '../../modules/ventes/services/venteService';
import { pageCommerciale, pageVenteEspace } from '../../modules/ventes/utils/accesCommercial';
import { formaterDate, formaterMontant, formaterNombre, formaterQuantite } from '../../utils/formatage';

type Action = 'valider' | 'annuler';

/**
 * /:activite/ventes/:id : prix appliqués, total, encaissements, retours, solde et trop-perçu renvoyés par l'API,
 * mouvements de stock pour qui consulte le stock. Vente directe : Modifier (brouillon), Valider, Annuler ;
 * vente validée : Saisir un encaissement ou un retour dans l'espace ouvert, selon les droits.
 */
export function VentePage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const espace = useEspaceVente();
  const base = `/${espace}/ventes`;
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const actionListe = useActionListe<Action>(['valider', 'annuler']);
  const [action, setAction] = useState<Action | null>(actionListe);
  const requete = useRequete((signal) => venteService.consulter(id, signal), [id]);
  const vente = requete.donnees;
  const clients = optionsClients(useClientsReference(profil));
  const produits = useProduitsReference(profil);
  const encaissements = useEncaissementsVente(profil, id, vente?.updated_at);
  const retours = useRetoursVente(profil, id, vente?.updated_at);
  const consulteStock = possedePermission(profil, 'stock');
  const mouvements = useMouvementsOrigine(vente?.validated_at ? { type: 'vente', id, version: vente.updated_at } : null, consulteStock);
  const produit = (produitId: string) => produits.find((element) => element._id === produitId);

  const validee = vente?.statut === 'validee';
  const directe = vente ? vente.commande_id === null : false;
  const peutValider = possedePermission(profil, 'ventes', 'validation');
  const retournable = vente?.lignes.some((ligne) => Number(ligne.quantite) > Number(ligne.quantite_retournee)) ?? false;
  const peutEncaisser = validee && Number(vente?.solde ?? 0) > 0 && pageVenteEspace(profil, espace, 'encaissements', 'saisie');
  const peutRetourner = validee && retournable && pageVenteEspace(profil, espace, 'retours_clients', 'saisie');
  const lienEncaissements = pageVenteEspace(profil, espace, 'encaissements');
  const lienRetours = pageVenteEspace(profil, espace, 'retours_clients');

  async function confirmer(choix: Action, motif: string) {
    try {
      if (choix === 'valider') await venteService.valider(id);
      else await venteService.annuler(id, motif);
    } catch (cause) {
      const stock = messageStockInsuffisant(cause, produits, 'La vente reste en brouillon.');
      if (stock) throw new Error(stock.message);
      throw cause;
    }
    setAction(null);
    setMessage(choix === 'valider' ? 'Vente validée : les produits sont sortis du stock.' : 'Vente annulée.');
    requete.recharger();
  }

  return (
    <section>
      <EnTetePage
        retour={{ to: base, libelle: 'Retour aux ventes' }}
        titre={vente ? `Vente · ${libelleReference(clients, vente.client_id, 'Nom du client indisponible')}` : 'Vente'}
        sousTitre={vente ? `${formaterDate(vente.date_vente)} · ${LIBELLES_ACTIVITES[vente.activite]} · ${directe ? 'vente directe' : 'commande livrée'}` : undefined}
        actions={
          vente && (
            <>
              {peutEncaisser && (
                <Link to={`/${espace}/encaissements/nouveau?vente_id=${id}`} className="bouton">
                  Saisir un encaissement
                </Link>
              )}
              {peutRetourner && (
                <Link to={`/${espace}/retours-clients/nouveau?vente_id=${id}`} className="bouton bouton--secondaire">
                  Saisir un retour
                </Link>
              )}
              {vente.statut === 'brouillon' && directe && possedePermission(profil, 'ventes', 'saisie') && (
                <Link to={`${base}/${id}/modifier`} className="bouton bouton--secondaire">
                  Modifier
                </Link>
              )}
              {vente.statut === 'brouillon' && peutValider && (
                <button type="button" className="bouton" onClick={() => setAction('valider')}>
                  Valider
                </button>
              )}
              {directe && vente.statut !== 'annulee' && peutValider && (
                <button type="button" className="bouton bouton--danger" onClick={() => setAction('annuler')}>
                  Annuler
                </button>
              )}
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      {vente && validee && !pageVenteEspace(profil, espace, 'encaissements', 'saisie') && !pageVenteEspace(profil, espace, 'retours_clients', 'saisie') && (
        <Alerte ton="information">Votre profil ne permet pas de saisir les encaissements et retours de cette vente.</Alerte>
      )}
      <BlocRequete {...requete} cartes={4} libelleChargement="Chargement de la vente…">
        {(fiche) => (
          <>
            <SituationVenteCartes situation={fiche} />
            <div className="page-etroite">
              <FicheDonnees
                lignes={[
                  ['Statut', <PastilleStatut key="statut" {...STATUTS_PRODUCTION[fiche.statut]} />],
                  [
                    'Client',
                    pageVenteEspace(profil, espace, 'clients') ? (
                      <Link key="client" to={`/${espace}/clients/${fiche.client_id}`}>
                        {libelleReference(clients, fiche.client_id, 'Nom du client indisponible')}
                      </Link>
                    ) : (
                      libelleReference(clients, fiche.client_id, 'Nom du client indisponible')
                    ),
                  ],
                  ['Activité', LIBELLES_ACTIVITES[fiche.activite]],
                  [
                    'Origine',
                    fiche.commande_id ? (
                      pageCommerciale(profil, 'commandes_clients') ? (
                        <Link key="commande" to={`/commercialisation/commandes-clients/${fiche.commande_id}`}>
                          Commande livrée
                        </Link>
                      ) : (
                        'Commande livrée'
                      )
                    ) : (
                      'Vente directe'
                    ),
                  ],
                  ['Validée le', fiche.validated_at ? formaterDate(fiche.validated_at) : null],
                  ['Annulée le', fiche.annulee_at ? formaterDate(fiche.annulee_at) : null],
                  ['Motif d’annulation', fiche.motif_annulation],
                ]}
              />
            </div>

            <div className="section-fiche panneau">
              <h2 className="panneau__titre">Lignes et prix appliqués</h2>
              <div className="tableau-defilant">
                <table className="tableau">
                  <thead>
                    <tr>
                      <th scope="col">Produit</th>
                      <th scope="col" className="nombre">Quantité</th>
                      <th scope="col" className="nombre">Retournée</th>
                      <th scope="col" className="nombre">Prix appliqué</th>
                      <th scope="col" className="nombre">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiche.lignes.map((ligne) => (
                      <tr key={ligne.ligne_id}>
                        <th scope="row">{produit(ligne.produit_id)?.nom ?? ligne.produit_nom ?? 'Produit hors catalogue'}</th>
                        <td className="nombre">{formaterQuantite(ligne.quantite, produit(ligne.produit_id)?.unite_stock)}</td>
                        <td className="nombre">{Number(ligne.quantite_retournee) > 0 ? formaterNombre(ligne.quantite_retournee) : '—'}</td>
                        <td className="nombre">{formaterMontant(ligne.prix_unitaire)}</td>
                        <td className="nombre">{formaterMontant(ligne.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" colSpan={4}>
                        Total
                      </th>
                      <td className="nombre">{formaterMontant(fiche.montant_total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {possedePermission(profil, 'encaissements') && fiche.statut !== 'brouillon' && (
              <div className="section-fiche panneau">
                <h2 className="panneau__titre">Encaissements</h2>
                {encaissements.length === 0 ? (
                  <p className="texte-doux">Aucun encaissement saisi pour cette vente.</p>
                ) : (
                  <table className="tableau">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Mode</th>
                        <th scope="col" className="nombre">Montant</th>
                        <th scope="col">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {encaissements.map((encaissement) => (
                        <tr key={encaissement._id}>
                          <th scope="row">
                            {lienEncaissements ? (
                              <Link to={`/${espace}/encaissements/${encaissement._id}`}>{formaterDate(encaissement.date_paiement)}</Link>
                            ) : (
                              formaterDate(encaissement.date_paiement)
                            )}
                          </th>
                          <td>{LIBELLES_MODES[encaissement.mode]}</td>
                          <td className="nombre">{formaterMontant(encaissement.montant)}</td>
                          <td>
                            <PastilleStatut {...STATUTS_PRODUCTION[encaissement.statut]} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {possedePermission(profil, 'retours_clients') && fiche.statut !== 'brouillon' && (
              <div className="section-fiche panneau">
                <h2 className="panneau__titre">Retours</h2>
                {retours.length === 0 ? (
                  <p className="texte-doux">Aucun retour saisi pour cette vente.</p>
                ) : (
                  <table className="tableau">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Produits retournés</th>
                        <th scope="col" className="nombre">Montant</th>
                        <th scope="col">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {retours.map((retour) => (
                        <tr key={retour._id}>
                          <th scope="row">
                            {lienRetours ? <Link to={`/${espace}/retours-clients/${retour._id}`}>{formaterDate(retour.date_retour)}</Link> : formaterDate(retour.date_retour)}
                          </th>
                          <td>
                            {retour.lignes
                              .map((ligne) => `${produit(ligne.produit_id)?.nom ?? ligne.produit_nom ?? 'Produit hors catalogue'} ${formaterQuantite(ligne.quantite, produit(ligne.produit_id)?.unite_stock)}`)
                              .join(' · ')}
                          </td>
                          <td className="nombre">{formaterMontant(retour.montant)}</td>
                          <td>
                            <PastilleStatut {...STATUTS_PRODUCTION[retour.statut]} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {fiche.validated_at && consulteStock && (
              <div className="section-fiche panneau">
                <h2 className="panneau__titre">Mouvements de stock</h2>
                {mouvements.length === 0 ? (
                  <p className="texte-doux">Aucun mouvement trouvé pour cette vente.</p>
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
                            <Link to={`/${espace}/mouvements-stock/${mouvement._id}`}>{formaterDate(mouvement.date_mouvement)}</Link>
                          </th>
                          <td>{produit(mouvement.produit_id)?.nom ?? mouvement.produit_nom ?? 'Produit hors catalogue'}</td>
                          <td className={mouvement.sens}>{LIBELLES_SENS[mouvement.sens]}</td>
                          <td className="nombre">{formaterQuantite(mouvement.quantite, produit(mouvement.produit_id)?.unite_stock)}</td>
                          <td>{mouvement.annule_mouvement_id ? 'Contre-écriture (annulation)' : 'Sortie vendue'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {retours.some((retour) => retour.statut === 'validee') && (
                  <p className="texte-doux">Les retours en stock de la quantité revendable figurent sur la fiche de chaque retour.</p>
                )}
              </div>
            )}
          </>
        )}
      </BlocRequete>
      {action && vente && actionTransactionAutorisee(action, peutValider, 'ventes', vente) && (
        <DialogueAction
          titre={action === 'valider' ? 'Valider la vente ?' : 'Annuler la vente ?'}
          libelleConfirmer={action === 'valider' ? 'Valider' : 'Annuler la vente'}
          danger={action === 'annuler'}
          motif={action === 'annuler'}
          onFermer={() => setAction(null)}
          onConfirmer={(motif) => confirmer(action, motif)}
        >
          <p>
            {action === 'valider'
              ? 'Les produits sortiront du stock et la vente ne sera plus modifiable.'
              : vente.statut === 'validee'
                ? 'Les encaissements et retours validés doivent d’abord être annulés ; les produits reviendront en stock.'
                : 'Le brouillon sera annulé et restera dans l’historique.'}
          </p>
        </DialogueAction>
      )}
    </section>
  );
}
