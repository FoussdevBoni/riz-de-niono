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
import { commandeClientService } from '../../modules/commercialisation/commandes-clients/services/commandeClientService';
import { STATUTS_COMMANDE } from '../../modules/commercialisation/commandes-clients/utils/statutCommande';
import { useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';
import { messageStockInsuffisant } from '../../modules/stock/utils/messageStock';
import { formaterDate, formaterMontant, formaterQuantite } from '../../utils/formatage';

const BASE = '/commercialisation/commandes-clients';

type Action = 'expedier' | 'livrer' | 'annuler';

const TEXTES: Record<Action, { titre: string; confirmer: string }> = {
  expedier: { titre: 'Passer la commande en expédition ?', confirmer: 'Marquer en expédition' },
  livrer: { titre: 'Livrer la commande ?', confirmer: 'Livrer' },
  annuler: { titre: 'Annuler la commande ?', confirmer: 'Annuler la commande' },
};

/**
 * /commercialisation/commandes-clients/:id : lignes et prix appliqués. En cours : Modifier (saisie),
 * Expédier ; en cours ou en expédition : Livrer et Annuler (validation). La livraison crée la vente validée
 * et sort le stock ; la fiche donne alors accès à la vente.
 */
export function CommandeClientPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const actionListe = useActionListe<Action>(['expedier', 'livrer', 'annuler']);
  const [action, setAction] = useState<Action | null>(actionListe);
  const requete = useRequete((signal) => commandeClientService.consulter(id, signal), [id]);
  const clients = optionsClients(useClientsReference(profil));
  const produits = useProduitsReference(profil, 'commercialisation');
  const commande = requete.donnees;
  const peutValider = possedePermission(profil, 'commandes_clients', 'validation');
  const ouverte = commande?.statut === 'en_cours' || commande?.statut === 'en_expedition';
  const produit = (produitId: string) => produits.find((element) => element._id === produitId);

  async function confirmer(choix: Action, motif: string) {
    try {
      if (choix === 'expedier') await commandeClientService.expedier(id);
      else if (choix === 'livrer') await commandeClientService.livrer(id);
      else await commandeClientService.annuler(id, motif);
    } catch (cause) {
      const stock = messageStockInsuffisant(cause, produits, 'La commande n’a pas changé.');
      if (stock) throw new Error(stock.message);
      throw cause;
    }
    setAction(null);
    setMessage(
      choix === 'expedier'
        ? 'Commande en expédition.'
        : choix === 'livrer'
          ? 'Commande livrée : la vente est créée et le stock est mis à jour.'
          : 'Commande annulée.',
    );
    requete.recharger();
  }

  return (
    <section>
      <EnTetePage
        retour={{ to: BASE, libelle: 'Retour aux commandes' }}
        titre={commande ? `Commande · ${libelleReference(clients, commande.client_id, 'Nom du client indisponible')}` : 'Commande client'}
        sousTitre={commande ? formaterDate(commande.date_commande) : undefined}
        actions={
          commande && (
            <>
              {commande.vente_id && (
                <Link to={`/commercialisation/ventes/${commande.vente_id}`} className="bouton">
                  Voir la vente
                </Link>
              )}
              {commande.statut === 'en_cours' && possedePermission(profil, 'commandes_clients', 'saisie') && (
                <Link to={`${BASE}/${id}/modifier`} className="bouton bouton--secondaire">
                  Modifier
                </Link>
              )}
              {commande.statut === 'en_cours' && peutValider && (
                <button type="button" className="bouton bouton--secondaire" onClick={() => setAction('expedier')}>
                  Expédier
                </button>
              )}
              {ouverte && peutValider && (
                <button type="button" className="bouton" onClick={() => setAction('livrer')}>
                  Livrer
                </button>
              )}
              {ouverte && peutValider && (
                <button type="button" className="bouton bouton--danger" onClick={() => setAction('annuler')}>
                  Annuler
                </button>
              )}
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de la commande…">
        {(fiche) => (
          <>
            <div className="page-etroite">
              <FicheDonnees
                lignes={[
                  ['Statut', <PastilleStatut key="statut" {...STATUTS_COMMANDE[fiche.statut]} />],
                  [
                    'Client',
                    <Link key="client" to={`/commercialisation/clients/${fiche.client_id}`}>
                      {libelleReference(clients, fiche.client_id, 'Nom du client indisponible')}
                    </Link>,
                  ],
                  ['Date', formaterDate(fiche.date_commande)],
                  ['Montant', formaterMontant(fiche.montant_total)],
                  ['Expédiée le', fiche.expediee_at ? formaterDate(fiche.expediee_at) : null],
                  ['Livrée le', fiche.livree_at ? formaterDate(fiche.livree_at) : null],
                  ['Vente', fiche.vente_id ? <Link key="vente" to={`/commercialisation/ventes/${fiche.vente_id}`}>Ouvrir la vente créée</Link> : null],
                  ['Annulée le', fiche.annulee_at ? formaterDate(fiche.annulee_at) : null],
                  ['Motif d’annulation', fiche.motif_annulation],
                ]}
              />
            </div>
            <div className="section-fiche panneau">
              <h2 className="panneau__titre">Lignes</h2>
              <table className="tableau">
                <thead>
                  <tr>
                    <th scope="col">Produit</th>
                    <th scope="col" className="nombre">Quantité</th>
                    <th scope="col" className="nombre">Prix appliqué</th>
                    <th scope="col" className="nombre">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {fiche.lignes.map((ligne) => (
                    <tr key={ligne.ligne_id}>
                      <th scope="row">{produit(ligne.produit_id)?.nom ?? ligne.produit_nom ?? 'Produit hors catalogue'}</th>
                      <td className="nombre">{formaterQuantite(ligne.quantite, produit(ligne.produit_id)?.unite_stock)}</td>
                      <td className="nombre">{formaterMontant(ligne.prix_unitaire)}</td>
                      <td className="nombre">{formaterMontant(ligne.montant)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={3}>
                      Total
                    </th>
                    <td className="nombre">{formaterMontant(fiche.montant_total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </BlocRequete>
      {action && commande && actionTransactionAutorisee(action, peutValider, 'commandes', commande) && (
        <DialogueAction
          titre={TEXTES[action].titre}
          libelleConfirmer={TEXTES[action].confirmer}
          danger={action === 'annuler'}
          motif={action === 'annuler' ? 'facultatif' : false}
          onFermer={() => setAction(null)}
          onConfirmer={(motif) => confirmer(action, motif)}
        >
          <p>
            {action === 'expedier'
              ? 'La commande reste modifiable seulement en cours ; en expédition, elle se livre ou s’annule.'
              : action === 'livrer'
                ? 'Une vente validée sera créée avec ces lignes et ces prix, et les produits sortiront du stock.'
                : 'Une commande annulée ne se livre plus. Après une livraison, utilisez les retours clients.'}
          </p>
        </DialogueAction>
      )}
    </section>
  );
}
