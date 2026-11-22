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
import { optionsCampagnes, useCampagnesReference } from '../../modules/production/campagnes-agricoles/hooks/useCampagnesAgricoles';
import { useEquipesReference } from '../../modules/production/equipes-production/hooks/useEquipesReference';
import { operationAgricoleService } from '../../modules/production/operations-agricoles/services/operationAgricoleService';
import { STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { optionsSites, useSitesReference } from '../../modules/production/sites-production/hooks/useSitesProduction';
import { useTypesOperationsReference } from '../../modules/production/types-operations-agricoles/hooks/useTypesOperationsReference';
import { useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';
import { useMouvementsOrigine } from '../../modules/stock/hooks/useMouvementsOrigine';
import { LIBELLES_SENS } from '../../modules/stock/utils/libellesStock';
import { codeErreur, detailsErreur } from '../../utils/erreurs';
import { formaterDate, formaterMontant, formaterNombre, formaterQuantite } from '../../utils/formatage';

const BASE = '/production/operations-agricoles';

type Action = 'valider' | 'annuler';

/**
 * /production/operations-agricoles/:id : fiche d'un travail, ses intrants et les mouvements de stock générés.
 * Brouillon : Modifier (saisie), Valider et Annuler (validation). Validé : Annuler avec motif (les intrants
 * reviennent en stock).
 */
export function OperationAgricolePage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const actionListe = useActionListe<Action>(['valider', 'annuler']);
  const [action, setAction] = useState<Action | null>(actionListe);
  const requete = useRequete((signal) => operationAgricoleService.consulter(id, signal), [id]);
  const campagnes = useCampagnesReference(profil);
  const sites = optionsSites(useSitesReference(profil));
  const types = useTypesOperationsReference(profil);
  const equipes = useEquipesReference(profil);
  const produits = useProduitsReference(profil, 'production');
  const operation = requete.donnees;
  const consulteStock = possedePermission(profil, 'stock');
  const mouvements = useMouvementsOrigine(
    operation?.validated_at ? { type: 'operation_agricole', id: operation._id, version: operation.updated_at } : null,
    consulteStock,
  );
  const brouillon = operation?.statut === 'brouillon';
  const peutValider = possedePermission(profil, 'operations_agricoles', 'validation');
  const campagne = campagnes.find((element) => element._id === operation?.campagne_id);
  const produit = (produitId: string) => produits.find((element) => element._id === produitId);

  return (
    <section className="page-etroite">
      <EnTetePage
        retour={{ to: BASE, libelle: 'Retour aux travaux' }}
        titre={operation ? (types.find((type) => type._id === operation.type_operation_id)?.nom ?? 'Travail agricole') : 'Travail agricole'}
        sousTitre={operation ? `${formaterDate(operation.date_operation)} · ${libelleReference(sites, operation.site_id, 'Nom du site indisponible')}` : undefined}
        actions={
          operation && (
            <>
              {brouillon && possedePermission(profil, 'operations_agricoles', 'saisie') && (
                <Link to={`${BASE}/${id}/modifier`} className="bouton bouton--secondaire">
                  Modifier
                </Link>
              )}
              {brouillon && peutValider && (
                <button type="button" className="bouton" onClick={() => setAction('valider')}>
                  Valider
                </button>
              )}
              {operation.statut !== 'annulee' && peutValider && (
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
        <Alerte ton="attention">La campagne est {campagne.statut === 'brouillon' ? 'encore en brouillon' : 'clôturée'} : la validation exige une campagne ouverte.</Alerte>
      )}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du travail…">
        {(fiche) => (
          <>
            <FicheDonnees
              lignes={[
                ['Statut', <PastilleStatut key="statut" {...STATUTS_PRODUCTION[fiche.statut]} />],
                ['Campagne', libelleReference(optionsCampagnes(campagnes), fiche.campagne_id, 'Nom de la campagne indisponible')],
                ['Site', libelleReference(sites, fiche.site_id, 'Nom du site indisponible')],
                ['Date', formaterDate(fiche.date_operation)],
                [
                  'Équipe',
                  fiche.equipe_id ? (
                    possedePermission(profil, 'equipes_production') ? (
                      <Link key="equipe" to={`/production/equipes-production/${fiche.equipe_id}`}>
                        {equipes.find((equipe) => equipe._id === fiche.equipe_id)?.nom ?? 'Équipe'}
                      </Link>
                    ) : (
                      'Nom de l’équipe indisponible'
                    )
                  ) : null,
                ],
                ['Journées de travail', fiche.journees_travail ? formaterNombre(fiche.journees_travail) : null],
                ['Coût de main-d’œuvre', fiche.cout_main_oeuvre ? formaterMontant(fiche.cout_main_oeuvre) : null],
                ['Validé le', fiche.validated_at ? formaterDate(fiche.validated_at) : null],
                ['Annulé le', fiche.annulee_at ? formaterDate(fiche.annulee_at) : null],
                ['Motif d’annulation', fiche.motif_annulation],
              ]}
            />
            <div className="section-fiche panneau">
              <h2 className="panneau__titre">Intrants utilisés</h2>
              {fiche.intrants.length === 0 ? (
                <p className="texte-doux">Aucun intrant déclaré.</p>
              ) : (
                <table className="tableau">
                  <thead>
                    <tr>
                      <th scope="col">Produit</th>
                      <th scope="col" className="nombre">Quantité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiche.intrants.map((intrant) => (
                      <tr key={intrant.ligne_id}>
                        <th scope="row">{produit(intrant.produit_id)?.nom ?? intrant.produit_nom ?? 'Produit hors catalogue'}</th>
                        <td className="nombre">{formaterQuantite(intrant.quantite, produit(intrant.produit_id)?.unite_stock)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {fiche.validated_at && consulteStock && fiche.intrants.length > 0 && (
              <div className="section-fiche panneau">
                <h2 className="panneau__titre">Mouvements de stock</h2>
                {mouvements.length === 0 ? (
                  <p className="texte-doux">Aucun mouvement trouvé pour ce travail.</p>
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
                            <Link to={`/production/mouvements-stock/${mouvement._id}`}>{formaterDate(mouvement.date_mouvement)}</Link>
                          </th>
                          <td>{produit(mouvement.produit_id)?.nom ?? mouvement.produit_nom ?? 'Produit hors catalogue'}</td>
                          <td className={mouvement.sens}>{LIBELLES_SENS[mouvement.sens]}</td>
                          <td className="nombre">{formaterQuantite(mouvement.quantite, produit(mouvement.produit_id)?.unite_stock)}</td>
                          <td>{mouvement.annule_mouvement_id ? 'Contre-écriture (annulation)' : 'Consommation d’intrant'}</td>
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
      {action && operation && actionTransactionAutorisee(action, peutValider, 'standard', operation) && (
        <DialogueAction
          titre={action === 'valider' ? 'Valider le travail ?' : 'Annuler le travail ?'}
          libelleConfirmer={action === 'valider' ? 'Valider' : 'Annuler le travail'}
          danger={action === 'annuler'}
          motif={action === 'annuler'}
          onFermer={() => setAction(null)}
          onConfirmer={async (motif) => {
            try {
              if (action === 'valider') await operationAgricoleService.valider(id);
              else await operationAgricoleService.annuler(id, motif);
            } catch (cause) {
              // Stock insuffisant : nommer le produit concerné et la quantité disponible.
              if (codeErreur(cause) === 'stock_insuffisant') {
                const details = detailsErreur(cause);
                const concerne = typeof details.produit_id === 'string' ? produit(details.produit_id) : undefined;
                const disponible = typeof details.quantite_disponible === 'string' ? details.quantite_disponible : '0';
                throw new Error(
                  `Stock insuffisant${concerne ? ` pour ${concerne.nom}` : ''} : ${formaterQuantite(disponible, concerne?.unite_stock)} disponibles. Le travail n’a pas changé.`,
                );
              }
              throw cause;
            }
            setAction(null);
            setMessage(action === 'valider' ? 'Travail validé : les intrants sont sortis du stock.' : 'Travail annulé.');
            requete.recharger();
          }}
        >
          <p>
            {action === 'valider'
              ? texteValidation(operation.intrants.length)
              : operation.statut === 'validee'
                ? 'Le travail reste dans l’historique et ses intrants reviennent en stock.'
                : 'Le brouillon sera annulé et restera dans l’historique.'}
          </p>
        </DialogueAction>
      )}
    </section>
  );
}

function texteValidation(intrants: number): string {
  return intrants === 0
    ? 'Le travail sera enregistré comme réalisé ; il ne consomme aucun intrant.'
    : `Les ${intrants} intrant${intrants > 1 ? 's' : ''} déclaré${intrants > 1 ? 's' : ''} sortiront du stock. Un travail validé ne se modifie plus.`;
}
