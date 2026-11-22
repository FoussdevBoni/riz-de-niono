import { actionTransactionAutorisee, useActionListe } from '../../components/ActionsTransaction';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { CarteIndicateur } from '../../components/CarteIndicateur';
import { DialogueAction } from '../../components/DialogueAction';
import { EnTetePage } from '../../components/EnTetePage';
import { FicheDonnees } from '../../components/FicheDonnees';
import { PastilleStatut } from '../../components/PastilleStatut';
import { useMessageNavigation } from '../../hooks/useMessageNavigation';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';
import { useMouvementsOrigine } from '../../modules/stock/hooks/useMouvementsOrigine';
import { LIBELLES_SENS } from '../../modules/stock/utils/libellesStock';
import { operationTransformationService } from '../../modules/transformation/operations-transformation/services/operationTransformationService';
import { useUnitesReference } from '../../modules/transformation/unites-transformation/hooks/useUnitesReference';
import { codeErreur, detailsErreur } from '../../utils/erreurs';
import { formaterDate, formaterNombre, formaterQuantite } from '../../utils/formatage';

const BASE = '/transformation/operations-transformation';

type Action = 'valider' | 'annuler';

/**
 * /transformation/operations-transformation/:id : paddy consommé, produits obtenus avec leur part,
 * note d'écart et mouvements de stock (origine_type + origine_id) pour qui consulte le stock.
 * Brouillon : Modifier (saisie), Valider et Annuler (validation) ; validée : Annuler avec motif.
 */
export function OperationTransformationPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const actionListe = useActionListe<Action>(['valider', 'annuler']);
  const [action, setAction] = useState<Action | null>(actionListe);
  const requete = useRequete((signal) => operationTransformationService.consulter(id, signal), [id]);
  const unites = useUnitesReference(profil);
  const produits = useProduitsReference(profil, 'transformation');
  const operation = requete.donnees;
  const consulteStock = possedePermission(profil, 'stock');
  const mouvements = useMouvementsOrigine(
    operation?.validated_at ? { type: 'operation_transformation', id, version: operation.updated_at } : null,
    consulteStock,
  );
  const peutValider = possedePermission(profil, 'operations_transformation', 'validation');
  const produit = (produitId: string) => produits.find((element) => element._id === produitId);
  const unite = unites.find((element) => element._id === operation?.unite_transformation_id);

  async function confirmer(choix: Action, motif: string) {
    try {
      if (choix === 'valider') await operationTransformationService.valider(id);
      else await operationTransformationService.annuler(id, motif);
    } catch (cause) {
      if (codeErreur(cause) === 'stock_insuffisant') {
        const details = detailsErreur(cause);
        const concerne = typeof details.produit_id === 'string' ? produit(details.produit_id) : undefined;
        const disponible = typeof details.quantite_disponible === 'string' ? details.quantite_disponible : '0';
        throw new Error(
          `Stock insuffisant${concerne ? ` pour ${concerne.nom}` : ''} : ${formaterQuantite(disponible, concerne?.unite_stock)} disponibles. L’opération n’a pas changé.`,
        );
      }
      throw cause;
    }
    setAction(null);
    setMessage(choix === 'valider' ? 'Opération validée : le paddy est sorti du stock et les produits obtenus y sont entrés.' : 'Opération annulée.');
    requete.recharger();
  }

  return (
    <section>
      <EnTetePage
        retour={{ to: BASE, libelle: 'Retour aux opérations' }}
        titre={operation ? `Transformation · ${unite?.nom ?? 'unité'}` : 'Opération de transformation'}
        sousTitre={operation ? formaterDate(operation.date_operation) : undefined}
        actions={
          operation && (
            <>
              {operation.statut === 'brouillon' && possedePermission(profil, 'operations_transformation', 'saisie') && (
                <Link to={`${BASE}/${id}/modifier`} className="bouton bouton--secondaire">
                  Modifier
                </Link>
              )}
              {operation.statut === 'brouillon' && peutValider && (
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
      <BlocRequete {...requete} cartes={3} libelleChargement="Chargement de l’opération…">
        {(fiche) => {
          const paddy = produit(fiche.paddy_produit_id);
          const consomme = Number(fiche.quantite_paddy);
          const total = fiche.resultats.reduce((somme, resultat) => somme + Number(resultat.quantite), 0);
          return (
            <>
              <div className="grille-indicateurs">
                <CarteIndicateur libelle="Paddy consommé" valeur={formaterQuantite(fiche.quantite_paddy, paddy?.unite_stock)} precision={paddy?.nom ?? fiche.paddy_produit_nom ?? null} />
                <CarteIndicateur libelle="Produits obtenus" valeur={formaterNombre(total)} precision={`${fiche.resultats.length} produit${fiche.resultats.length > 1 ? 's' : ''}`} />
                <CarteIndicateur libelle="Rendement" valeur={consomme > 0 ? `${formaterNombre((total / consomme) * 100, 1)} %` : '—'} precision="Total obtenu / paddy" ton="accent" />
              </div>
              <div className="page-etroite">
                <FicheDonnees
                  lignes={[
                    ['Statut', <PastilleStatut key="statut" {...STATUTS_PRODUCTION[fiche.statut]} />],
                    [
                      'Unité',
                      possedePermission(profil, 'unites_transformation') ? (
                        <Link key="unite" to={`/transformation/unites-transformation/${fiche.unite_transformation_id}`}>
                          {unite ? `${unite.nom}${unite.actif ? '' : ' (archivée)'}` : 'Unité'}
                        </Link>
                      ) : (
                        'Nom de l’unité indisponible'
                      ),
                    ],
                    ['Date', formaterDate(fiche.date_operation)],
                    ['Note d’écart', fiche.note_ecart],
                    ['Validée le', fiche.validated_at ? formaterDate(fiche.validated_at) : null],
                    ['Annulée le', fiche.annulee_at ? formaterDate(fiche.annulee_at) : null],
                    ['Motif d’annulation', fiche.motif_annulation],
                  ]}
                />
              </div>
              <div className="section-fiche panneau">
                <h2 className="panneau__titre">Produits obtenus</h2>
                <table className="tableau">
                  <thead>
                    <tr>
                      <th scope="col">Produit</th>
                      <th scope="col" className="nombre">Quantité</th>
                      <th scope="col" className="nombre">Part du paddy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiche.resultats.map((resultat) => (
                      <tr key={resultat.ligne_id}>
                        <th scope="row">{produit(resultat.produit_id)?.nom ?? resultat.produit_nom ?? 'Produit hors catalogue'}</th>
                        <td className="nombre">{formaterQuantite(resultat.quantite, produit(resultat.produit_id)?.unite_stock)}</td>
                        <td className="nombre">{consomme > 0 ? `${formaterNombre((Number(resultat.quantite) / consomme) * 100, 1)} %` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {fiche.validated_at && consulteStock && (
                <div className="section-fiche panneau">
                  <h2 className="panneau__titre">Mouvements de stock</h2>
                  {mouvements.length === 0 ? (
                    <p className="texte-doux">Aucun mouvement trouvé pour cette opération.</p>
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
                              <Link to={`/transformation/mouvements-stock/${mouvement._id}`}>{formaterDate(mouvement.date_mouvement)}</Link>
                            </th>
                            <td>{produit(mouvement.produit_id)?.nom ?? mouvement.produit_nom ?? 'Produit hors catalogue'}</td>
                            <td className={mouvement.sens}>{LIBELLES_SENS[mouvement.sens]}</td>
                            <td className="nombre">{formaterQuantite(mouvement.quantite, produit(mouvement.produit_id)?.unite_stock)}</td>
                            <td>
                              {mouvement.annule_mouvement_id
                                ? 'Contre-écriture (annulation)'
                                : mouvement.produit_id === fiche.paddy_produit_id
                                  ? 'Consommation du paddy'
                                  : 'Produit obtenu'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          );
        }}
      </BlocRequete>
      {action && operation && actionTransactionAutorisee(action, peutValider, 'standard', operation) && (
        <DialogueAction
          titre={action === 'valider' ? 'Valider l’opération ?' : 'Annuler l’opération ?'}
          libelleConfirmer={action === 'valider' ? 'Valider' : 'Annuler l’opération'}
          danger={action === 'annuler'}
          motif={action === 'annuler'}
          onFermer={() => setAction(null)}
          onConfirmer={(motif) => confirmer(action, motif)}
        >
          <p>
            {action === 'valider'
              ? `${formaterQuantite(operation.quantite_paddy, produit(operation.paddy_produit_id)?.unite_stock)} de paddy sortiront du stock et les produits obtenus y entreront. L’opération ne sera plus modifiable.`
              : operation.statut === 'validee'
                ? 'L’opération reste dans l’historique : le paddy revient en stock et les produits obtenus en sortent, s’ils sont encore disponibles.'
                : 'Le brouillon sera annulé et restera dans l’historique.'}
          </p>
        </DialogueAction>
      )}
    </section>
  );
}
