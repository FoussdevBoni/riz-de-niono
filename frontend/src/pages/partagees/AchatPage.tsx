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
import { libelleReference } from '../../hooks/useOptionsReference';
import { useRequete } from '../../hooks/useRequete';
import { achatService } from '../../modules/achats/services/achatService';
import { STATUTS_RECEPTION } from '../../modules/achats/utils/libellesAchats';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { optionsFournisseurs, useFournisseursReference } from '../../modules/fournisseurs/hooks/useFournisseursReference';
import { optionsCampagnes, useCampagnesReference } from '../../modules/production/campagnes-agricoles/hooks/useCampagnesAgricoles';
import { STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { optionsSites, useSitesReference } from '../../modules/production/sites-production/hooks/useSitesProduction';
import { useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';
import { LIBELLES_ACTIVITES } from '../../modules/produits/utils/libellesProduits';
import { useReglementsAchat } from '../../modules/reglements-fournisseurs/hooks/useReglementsAchat';
import { LIBELLES_MODES } from '../../modules/reglements-fournisseurs/utils/libellesReglements';
import { useMouvementsOrigine } from '../../modules/stock/hooks/useMouvementsOrigine';
import { LIBELLES_SENS } from '../../modules/stock/utils/libellesStock';
import { useUnitesReference } from '../../modules/transformation/unites-transformation/hooks/useUnitesReference';
import { codeErreur, detailsErreur, messageErreur } from '../../utils/erreurs';
import { estNul, formaterDate, formaterMontant, formaterNombre, formaterQuantite } from '../../utils/formatage';

type Action = 'valider' | 'receptionner' | 'annuler';

const TEXTES: Record<Action, { titre: string; confirmer: string }> = {
  valider: { titre: 'Valider l’achat ?', confirmer: 'Valider' },
  receptionner: { titre: 'Marquer l’achat comme reçu ?', confirmer: 'Marquer comme reçu' },
  annuler: { titre: 'Annuler l’achat ?', confirmer: 'Annuler l’achat' },
};

/**
 * /:activite/achats/:id : fiche d'achat avec les montants de l'API (total, réglé, solde), les lignes,
 * les règlements et, une fois reçu, les mouvements de stock. Actions selon le statut et les droits :
 * Modifier (brouillon, saisie), Valider, Marquer comme reçu et Annuler (validation).
 */
export function AchatPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const base = `/${activite}/achats`;
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const actionListe = useActionListe<Action>(['valider', 'annuler', 'receptionner']);
  const [action, setAction] = useState<Action | null>(actionListe);
  const requete = useRequete((signal) => achatService.consulter(id, signal), [id]);
  const achat = requete.donnees;
  const enProduction = achat?.activite === 'production';
  const fournisseurs = optionsFournisseurs(useFournisseursReference(profil));
  const produits = useProduitsReference(profil);
  const sites = optionsSites(useSitesReference(enProduction ? profil : null));
  const campagnes = optionsCampagnes(useCampagnesReference(enProduction ? profil : null));
  const unites = useUnitesReference(achat?.activite === 'transformation' ? profil : null);
  const reglements = useReglementsAchat(profil, id, achat?.updated_at);
  const consulteStock = possedePermission(profil, 'stock');
  const mouvements = useMouvementsOrigine(achat?.recu_at ? { type: 'achat', id, version: achat.updated_at } : null, consulteStock);

  const peutValider = possedePermission(profil, 'achats', 'validation');
  const peutRegler =
    achat?.statut === 'validee' &&
    Number(achat.solde_restant) > 0 &&
    possedePermission(profil, 'reglements_fournisseurs', 'saisie');
  const produit = (produitId: string | null) => produits.find((element) => element._id === produitId);

  async function executer(choix: Action, motif: string) {
    try {
      if (choix === 'valider') await achatService.valider(id);
      else if (choix === 'receptionner') await achatService.receptionner(id);
      else await achatService.annuler(id, motif);
    } catch (cause) {
      if (codeErreur(cause) === 'stock_insuffisant') {
        const details = detailsErreur(cause);
        const concerne = typeof details.produit_id === 'string' ? produit(details.produit_id) : undefined;
        throw new Error(
          `Stock insuffisant${concerne ? ` pour ${concerne.nom}` : ''} pour contrepasser la réception : ${formaterQuantite(
            typeof details.quantite_disponible === 'string' ? details.quantite_disponible : '0',
            concerne?.unite_stock,
          )} disponibles. L’achat n’a pas changé.`,
        );
      }
      throw new Error(messageErreur(cause));
    }
    setAction(null);
    setMessage(
      choix === 'valider'
        ? 'Achat validé.'
        : choix === 'receptionner'
          ? 'Achat reçu : les articles stockables sont entrés en stock.'
          : 'Achat annulé.',
    );
    requete.recharger();
  }

  return (
    <section>
      <EnTetePage
        retour={{ to: base, libelle: 'Retour aux achats' }}
        titre={achat ? `Achat · ${libelleReference(fournisseurs, achat.fournisseur_id, 'Nom du fournisseur indisponible')}` : 'Achat'}
        sousTitre={achat ? `${formaterDate(achat.date_achat)} · ${LIBELLES_ACTIVITES[achat.activite]}` : undefined}
        actions={
          achat && (
            <>
              {achat.statut === 'brouillon' && possedePermission(profil, 'achats', 'saisie') && (
                <Link to={`${base}/${id}/modifier`} className="bouton bouton--secondaire">
                  Modifier
                </Link>
              )}
              {peutRegler && (
                <Link to={`/${activite}/reglements-fournisseurs/nouveau?achat_id=${id}`} className="bouton bouton--secondaire">
                  Saisir un règlement
                </Link>
              )}
              {achat.statut === 'brouillon' && peutValider && (
                <button type="button" className="bouton" onClick={() => setAction('valider')}>
                  Valider
                </button>
              )}
              {achat.statut === 'validee' && achat.statut_reception === 'en_cours' && peutValider && (
                <button type="button" className="bouton" onClick={() => setAction('receptionner')}>
                  Marquer comme reçu
                </button>
              )}
              {achat.statut !== 'annulee' && peutValider && (
                <button type="button" className="bouton bouton--danger" onClick={() => setAction('annuler')}>
                  Annuler
                </button>
              )}
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      <BlocRequete {...requete} cartes={3} libelleChargement="Chargement de l’achat…">
        {(fiche) => (
          <>
            <div className="grille-indicateurs">
              <CarteIndicateur libelle="Montant total" valeur={formaterMontant(fiche.montant_total)} />
              <CarteIndicateur libelle="Montant réglé" valeur={formaterMontant(fiche.montant_regle)} precision="Règlements validés" />
              <CarteIndicateur
                libelle="Solde dû"
                valeur={formaterMontant(fiche.solde_restant)}
                ton={fiche.statut === 'validee' && !estNul(fiche.solde_restant) ? 'accent' : undefined}
              />
            </div>
            <div className="page-etroite">
              <FicheDonnees
                lignes={[
                  [
                    'Statut',
                    <span key="statut">
                      <PastilleStatut {...STATUTS_PRODUCTION[fiche.statut]} />
                      {fiche.statut_reception && <> <PastilleStatut {...STATUTS_RECEPTION[fiche.statut_reception]} /></>}
                    </span>,
                  ],
                  [
                    'Fournisseur',
                    possedePermission(profil, 'fournisseurs') ? (
                      <Link key="fournisseur" to={`/${activite}/fournisseurs/${fiche.fournisseur_id}`}>
                        {libelleReference(fournisseurs, fiche.fournisseur_id, 'Nom du fournisseur indisponible')}
                      </Link>
                    ) : (
                      libelleReference(fournisseurs, fiche.fournisseur_id, 'Nom du fournisseur indisponible')
                    ),
                  ],
                  ['Activité', LIBELLES_ACTIVITES[fiche.activite]],
                  ...(fiche.activite === 'production'
                    ? ([
                        ['Site', fiche.site_id ? libelleReference(sites, fiche.site_id, 'Nom du site indisponible') : null],
                        ['Campagne', fiche.campagne_id ? libelleReference(campagnes, fiche.campagne_id, 'Nom de la campagne indisponible') : null],
                      ] as [string, string | null][])
                    : []),
                  ...(fiche.activite === 'transformation'
                    ? ([['Unité', fiche.unite_transformation_id ? (unites.find((u) => u._id === fiche.unite_transformation_id)?.nom ?? null) : null]] as [string, string | null][])
                    : []),
                  ['Validé le', fiche.validated_at ? formaterDate(fiche.validated_at) : null],
                  ['Reçu le', fiche.recu_at ? formaterDate(fiche.recu_at) : null],
                  ['Annulé le', fiche.annulee_at ? formaterDate(fiche.annulee_at) : null],
                  ['Motif d’annulation', fiche.motif_annulation],
                ]}
              />
            </div>

            <div className="section-fiche panneau">
              <h2 className="panneau__titre">Lignes</h2>
              <div className="tableau-defilant">
                <table className="tableau">
                  <thead>
                    <tr>
                      <th scope="col">Libellé</th>
                      <th scope="col">Nature</th>
                      <th scope="col" className="nombre">Quantité</th>
                      <th scope="col" className="nombre">Prix unitaire</th>
                      <th scope="col" className="nombre">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiche.lignes.map((ligne) => {
                      const article = produit(ligne.produit_id);
                      return (
                        <tr key={ligne.ligne_id}>
                          <th scope="row">{ligne.libelle}</th>
                          <td>{ligne.produit_id ? (article ? `${article.nom}${article.stockable ? '' : ' (non stocké)'}` : 'Article') : 'Prestation'}</td>
                          <td className="nombre">{article ? formaterQuantite(ligne.quantite, article.unite_stock) : formaterNombre(ligne.quantite)}</td>
                          <td className="nombre">{formaterMontant(ligne.prix_unitaire)}</td>
                          <td className="nombre">{formaterMontant(ligne.montant)}</td>
                        </tr>
                      );
                    })}
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

            {possedePermission(profil, 'reglements_fournisseurs') && fiche.statut !== 'brouillon' && (
              <div className="section-fiche panneau">
                <h2 className="panneau__titre">Règlements</h2>
                {reglements.length === 0 ? (
                  <p className="texte-doux">Aucun règlement saisi pour cet achat.</p>
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
                      {reglements.map((reglement) => (
                        <tr key={reglement._id}>
                          <th scope="row">
                            <Link to={`/${activite}/reglements-fournisseurs/${reglement._id}`}>{formaterDate(reglement.date_paiement)}</Link>
                          </th>
                          <td>{LIBELLES_MODES[reglement.mode]}</td>
                          <td className="nombre">{formaterMontant(reglement.montant)}</td>
                          <td>
                            <PastilleStatut {...STATUTS_PRODUCTION[reglement.statut]} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {fiche.recu_at && consulteStock && (
              <div className="section-fiche panneau">
                <h2 className="panneau__titre">Mouvements de stock</h2>
                {mouvements.length === 0 ? (
                  <p className="texte-doux">Aucun mouvement trouvé pour cet achat.</p>
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
                            <Link to={`/${activite}/mouvements-stock/${mouvement._id}`}>{formaterDate(mouvement.date_mouvement)}</Link>
                          </th>
                          <td>{produit(mouvement.produit_id)?.nom ?? mouvement.produit_nom ?? 'Produit hors catalogue'}</td>
                          <td className={mouvement.sens}>{LIBELLES_SENS[mouvement.sens]}</td>
                          <td className="nombre">{formaterQuantite(mouvement.quantite, produit(mouvement.produit_id)?.unite_stock)}</td>
                          <td>{mouvement.annule_mouvement_id ? 'Contre-écriture (annulation)' : 'Réception'}</td>
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
      {action && achat && actionTransactionAutorisee(action, peutValider, 'achats', achat) && (
        <DialogueAction
          titre={TEXTES[action].titre}
          libelleConfirmer={TEXTES[action].confirmer}
          danger={action === 'annuler'}
          motif={action === 'annuler'}
          onFermer={() => setAction(null)}
          onConfirmer={(motif) => executer(action, motif)}
        >
          <p>
            {action === 'valider'
              ? achat.lignes.some((ligne) => produit(ligne.produit_id)?.stockable)
                ? 'L’achat ne sera plus modifiable. Ses articles stockables seront à réceptionner pour entrer en stock.'
                : 'L’achat ne sera plus modifiable. Il ne comporte pas d’article stockable.'
              : action === 'receptionner'
                ? 'Les articles stockables entreront en stock, une seule fois.'
                : achat.statut_reception === 'recu'
                  ? 'L’achat reste dans l’historique et les quantités reçues sortent du stock, si le stock le permet. Un achat réglé exige d’abord l’annulation de ses règlements.'
                  : 'L’achat reste dans l’historique. Un achat réglé exige d’abord l’annulation de ses règlements.'}
          </p>
        </DialogueAction>
      )}
    </section>
  );
}
