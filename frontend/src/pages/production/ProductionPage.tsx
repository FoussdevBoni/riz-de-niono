import { actionTransactionAutorisee, useActionListe } from '../../components/ActionsTransaction';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

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
import { optionsCampagnes, useCampagnesReference } from '../../modules/production/campagnes-agricoles/hooks/useCampagnesAgricoles';
import { productionService } from '../../modules/production/productions/services/productionService';
import { STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { optionsSites, useSitesReference } from '../../modules/production/sites-production/hooks/useSitesProduction';
import { useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';
import { useMouvementsOrigine } from '../../modules/stock/hooks/useMouvementsOrigine';
import { LIBELLES_SENS } from '../../modules/stock/utils/libellesStock';
import { formaterDate, formaterNombre, formaterQuantite } from '../../utils/formatage';

const BASE = '/production/productions';

type Action = 'valider' | 'annuler';

/**
 * /production/productions/:id : fiche d'une récolte. Brouillon : Modifier (saisie), Valider et Annuler
 * (validation). Validée : Annuler avec motif, qui contrepasse l'entrée en stock si le stock le permet.
 * Les mouvements de stock générés sont listés quand l'utilisateur consulte le stock.
 */
export function ProductionPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const actionListe = useActionListe<Action>(['valider', 'annuler']);
  const [action, setAction] = useState<Action | null>(actionListe);
  const requete = useRequete((signal) => productionService.consulter(id, signal), [id]);
  const campagnes = useCampagnesReference(profil);
  const sites = optionsSites(useSitesReference(profil));
  const produits = useProduitsReference(profil, 'production');
  const production = requete.donnees;
  const consulteStock = possedePermission(profil, 'stock');
  const mouvements = useMouvementsOrigine(
    production?.validated_at ? { type: 'production', id: production._id, version: production.updated_at } : null,
    consulteStock,
  );

  const peutSaisir = possedePermission(profil, 'productions', 'saisie');
  const peutValider = possedePermission(profil, 'productions', 'validation');
  const brouillon = production?.statut === 'brouillon';
  const unite = produits.find((produit) => produit._id === production?.produit_id)?.unite_stock;
  const campagne = campagnes.find((element) => element._id === production?.campagne_id);

  return (
    <section className="page-etroite">
      <EnTetePage
        retour={{ to: BASE, libelle: 'Retour aux récoltes' }}
        titre="Récolte"
        sousTitre={production ? `${formaterDate(production.date_recolte)} · ${libelleReference(sites, production.site_id, 'Nom du site indisponible')}` : undefined}
        actions={
          production && (
            <>
              {brouillon && peutSaisir && (
                <Link to={`${BASE}/${id}/modifier`} className="bouton bouton--secondaire">
                  Modifier
                </Link>
              )}
              {brouillon && peutValider && (
                <button type="button" className="bouton" onClick={() => setAction('valider')}>
                  Valider
                </button>
              )}
              {production.statut !== 'annulee' && peutValider && (
                <button type="button" className="bouton bouton--danger" onClick={() => setAction('annuler')}>
                  Annuler
                </button>
              )}
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      {brouillon && campagne && campagne.statut !== 'ouverte' && (
        <Alerte ton="attention">
          La campagne est {campagne.statut === 'brouillon' ? 'encore en brouillon' : 'clôturée'} : la validation exige une campagne ouverte.
        </Alerte>
      )}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de la récolte…">
        {(fiche) => (
          <>
            <FicheDonnees
              lignes={[
                ['Statut', <PastilleStatut key="statut" {...STATUTS_PRODUCTION[fiche.statut]} />],
                [
                  'Campagne',
                  possedePermission(profil, 'campagnes_agricoles') ? (
                    <Link key="campagne" to={`/production/campagnes-agricoles/${fiche.campagne_id}`}>
                      {libelleReference(optionsCampagnes(campagnes), fiche.campagne_id, 'Nom de la campagne indisponible')}
                    </Link>
                  ) : (
                    libelleReference(optionsCampagnes(campagnes), fiche.campagne_id, 'Nom de la campagne indisponible')
                  ),
                ],
                ['Site', libelleReference(sites, fiche.site_id, 'Nom du site indisponible')],
                ['Produit', produits.find((produit) => produit._id === fiche.produit_id)?.nom ?? fiche.produit_nom ?? 'Produit hors catalogue'],
                ['Date de récolte', formaterDate(fiche.date_recolte)],
                ['Quantité', formaterQuantite(fiche.quantite, unite)],
                ['Superficie récoltée', `${formaterNombre(fiche.superficie_recoltee_ha)} ha`],
                ['Validée le', fiche.validated_at ? formaterDate(fiche.validated_at) : null],
                ['Annulée le', fiche.annulee_at ? formaterDate(fiche.annulee_at) : null],
                ['Motif d’annulation', fiche.motif_annulation],
              ]}
            />
            {fiche.validated_at && consulteStock && (
              <div className="section-fiche panneau">
                <h2 className="panneau__titre">Mouvements de stock</h2>
                {mouvements.length === 0 ? (
                  <p className="texte-doux">Aucun mouvement trouvé pour cette récolte.</p>
                ) : (
                  <table className="tableau">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Sens</th>
                        <th scope="col" className="nombre">Quantité</th>
                        <th scope="col">Nature</th>
                        <th scope="col" className="colonne-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mouvements.map((mouvement) => (
                        <TableRow key={mouvement._id} actions={<ActionsFiche to={`/production/mouvements-stock/${mouvement._id}`} />}>
                          <th scope="row">
                            <Link to={`/production/mouvements-stock/${mouvement._id}`}>{formaterDate(mouvement.date_mouvement)}</Link>
                          </th>
                          <td className={mouvement.sens}>{LIBELLES_SENS[mouvement.sens]}</td>
                          <td className="nombre">{formaterQuantite(mouvement.quantite, unite)}</td>
                          <td>{mouvement.annule_mouvement_id ? 'Contre-écriture (annulation)' : 'Entrée de la récolte'}</td>
                        </TableRow>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </BlocRequete>
      {action && production && actionTransactionAutorisee(action, peutValider, 'standard', production) && (
        <DialogueAction
          titre={action === 'valider' ? 'Valider la récolte ?' : 'Annuler la récolte ?'}
          libelleConfirmer={action === 'valider' ? 'Valider' : 'Annuler la récolte'}
          danger={action === 'annuler'}
          motif={action === 'annuler'}
          onFermer={() => setAction(null)}
          onConfirmer={async (motif) => {
            if (action === 'valider') await productionService.valider(id);
            else await productionService.annuler(id, motif);
            setAction(null);
            setMessage(action === 'valider' ? 'Récolte validée : la quantité a été ajoutée au stock.' : 'Récolte annulée.');
            requete.recharger();
          }}
        >
          <p>
            {action === 'valider'
              ? `${formaterQuantite(production.quantite, unite)} seront ajoutés au stock. Une récolte validée ne se modifie plus.`
              : production.statut === 'validee'
                ? 'La récolte reste dans l’historique et son entrée en stock est contrepassée, si le stock disponible le permet.'
                : 'Le brouillon sera annulé et restera dans l’historique.'}
          </p>
        </DialogueAction>
      )}
    </section>
  );
}
