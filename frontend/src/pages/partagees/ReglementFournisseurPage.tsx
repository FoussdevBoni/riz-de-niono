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
import { useActiviteCourante } from '../../hooks/useActiviteCourante';
import { useMessageNavigation } from '../../hooks/useMessageNavigation';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { LIBELLES_ACTIVITES } from '../../modules/produits/utils/libellesProduits';
import { reglementFournisseurService } from '../../modules/reglements-fournisseurs/services/reglementFournisseurService';
import { LIBELLES_MODES } from '../../modules/reglements-fournisseurs/utils/libellesReglements';
import { codeErreur, detailsErreur, messageErreur } from '../../utils/erreurs';
import { formaterDate, formaterMontant } from '../../utils/formatage';

type Action = 'valider' | 'annuler';

/**
 * /:activite/reglements-fournisseurs/:id : règlement et situation de son achat (règlements validés).
 * Brouillon : Modifier (saisie), Valider et Annuler (validation). Validé : Annuler avec motif, qui retire
 * son montant du montant réglé.
 */
export function ReglementFournisseurPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const base = `/${activite}/reglements-fournisseurs`;
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const actionListe = useActionListe<Action>(['valider', 'annuler']);
  const [action, setAction] = useState<Action | null>(actionListe);
  const requete = useRequete((signal) => reglementFournisseurService.consulter(id, signal), [id]);
  const reglement = requete.donnees;
  const peutValider = possedePermission(profil, 'reglements_fournisseurs', 'validation');

  return (
    <section className="page-etroite">
      <EnTetePage
        retour={{ to: reglement ? `${base}?achat_id=${reglement.achat_id}` : base, libelle: 'Règlements de cet achat' }}
        titre={reglement ? `Règlement de ${formaterMontant(reglement.montant)}` : 'Règlement fournisseur'}
        sousTitre={reglement ? `${formaterDate(reglement.date_paiement)} · ${LIBELLES_MODES[reglement.mode]}` : undefined}
        actions={
          reglement && (
            <>
              {reglement.statut === 'brouillon' && possedePermission(profil, 'reglements_fournisseurs', 'saisie') && (
                <Link to={`${base}/${id}/modifier`} className="bouton bouton--secondaire">
                  Modifier
                </Link>
              )}
              {reglement.statut === 'brouillon' && peutValider && (
                <button type="button" className="bouton" onClick={() => setAction('valider')}>
                  Valider
                </button>
              )}
              {reglement.statut !== 'annulee' && peutValider && (
                <button type="button" className="bouton bouton--danger" onClick={() => setAction('annuler')}>
                  Annuler
                </button>
              )}
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      <BlocRequete {...requete} cartes={3} libelleChargement="Chargement du règlement…">
        {(fiche) => (
          <>
            <div className="grille-indicateurs">
              <CarteIndicateur libelle="Total de l’achat" valeur={formaterMontant(fiche.achat.montant_total)} />
              <CarteIndicateur libelle="Déjà réglé" valeur={formaterMontant(fiche.achat.montant_regle)} precision="Règlements validés" />
              <CarteIndicateur libelle="Solde dû" valeur={formaterMontant(fiche.achat.solde_restant)} ton="accent" />
            </div>
            <FicheDonnees
              lignes={[
                ['Statut', <PastilleStatut key="statut" {...STATUTS_PRODUCTION[fiche.statut]} />],
                [
                  'Achat',
                  possedePermission(profil, 'achats') ? (
                    <Link key="achat" to={`/${activite}/achats/${fiche.achat_id}`}>
                      Ouvrir la fiche de l’achat
                    </Link>
                  ) : (
                    'Achat indisponible'
                  ),
                ],
                ['Activité', LIBELLES_ACTIVITES[fiche.activite]],
                ['Montant', formaterMontant(fiche.montant)],
                ['Date du paiement', formaterDate(fiche.date_paiement)],
                ['Mode', LIBELLES_MODES[fiche.mode]],
                ['Référence', fiche.reference],
                ['Validé le', fiche.validated_at ? formaterDate(fiche.validated_at) : null],
                ['Annulé le', fiche.annulee_at ? formaterDate(fiche.annulee_at) : null],
                ['Motif d’annulation', fiche.motif_annulation],
              ]}
            />
          </>
        )}
      </BlocRequete>
      {action && reglement && actionTransactionAutorisee(action, peutValider, 'standard', reglement) && (
        <DialogueAction
          titre={action === 'valider' ? 'Valider le règlement ?' : 'Annuler le règlement ?'}
          libelleConfirmer={action === 'valider' ? 'Valider' : 'Annuler le règlement'}
          danger={action === 'annuler'}
          motif={action === 'annuler'}
          onFermer={() => setAction(null)}
          onConfirmer={async (motif) => {
            try {
              if (action === 'valider') await reglementFournisseurService.valider(id);
              else await reglementFournisseurService.annuler(id, motif);
            } catch (cause) {
              if (codeErreur(cause) === 'montant_superieur_au_solde') {
                const solde = detailsErreur(cause).solde_restant;
                throw new Error(`${messageErreur(cause)}${typeof solde === 'string' ? ` Solde dû : ${formaterMontant(solde)}.` : ''} Le règlement reste en brouillon.`);
              }
              throw cause;
            }
            setAction(null);
            setMessage(action === 'valider' ? 'Règlement validé : le solde de l’achat est à jour.' : 'Règlement annulé : son montant est retiré du montant réglé.');
            requete.recharger();
          }}
        >
          <p>
            {action === 'valider'
              ? `${formaterMontant(reglement.montant)} seront déduits du solde dû (${formaterMontant(reglement.achat.solde_restant)}).`
              : reglement.statut === 'validee'
                ? 'Le règlement reste dans l’historique ; son montant est retiré du montant réglé de l’achat.'
                : 'Le brouillon sera annulé et restera dans l’historique.'}
          </p>
        </DialogueAction>
      )}
    </section>
  );
}
