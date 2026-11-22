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
import { EncaissementFormulaire } from '../../modules/commercialisation/encaissements/components/EncaissementFormulaire';
import { encaissementService } from '../../modules/commercialisation/encaissements/services/encaissementService';
import type { DonneesEncaissement } from '../../modules/commercialisation/encaissements/types/encaissementTypes';
import { STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { LIBELLES_ACTIVITES } from '../../modules/produits/utils/libellesProduits';
import { LIBELLES_MODES } from '../../modules/reglements-fournisseurs/utils/libellesReglements';
import { SituationVenteCartes } from '../../modules/ventes/components/SituationVenteCartes';
import { useVentesValidees } from '../../modules/ventes/hooks/useVentes';
import { venteService } from '../../modules/ventes/services/venteService';
import type { Vente } from '../../modules/ventes/types/venteTypes';
import { espaceVente } from '../../modules/ventes/utils/accesCommercial';
import { codeErreur, detailsErreur, messageErreur } from '../../utils/erreurs';
import { formaterDate, formaterMontant } from '../../utils/formatage';

/** Base des pages dans l'espace de vente ouvert (/production/encaissements ou /commercialisation/encaissements). */
function useBase() {
  return `/${useEspaceVente()}/encaissements`;
}
const FILTRES = ['vente_id', 'page'] as const;

function useLibelleVente() {
  const { profil } = useSession();
  const clients = optionsClients(useClientsReference(profil));
  return (vente: Vente) => `${libelleReference(clients, vente.client_id, 'Nom du client indisponible')} · ${formaterDate(vente.date_vente)} · solde ${formaterMontant(vente.solde)}`;
}

/** /:activite/encaissements : encaissements visibles (ils suivent l'activité de leur vente), filtre vente_id. */
export function EncaissementsPage() {
  const BASE = useBase();
  const { profil } = useSession();
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const activite = useEspaceVente();
  // Le filtre activite se combine avec vente_id depuis la fiche d'une vente.
  const requete = useRequete(
    (signal) => encaissementService.lister({ activite, vente_id: filtres.vente_id, page, taille_page: 25 }, signal),
    [activite, filtres.vente_id, page],
  );
  const vente = useRequete((signal) => (filtres.vente_id ? venteService.consulter(filtres.vente_id, signal) : Promise.resolve(null)), [filtres.vente_id]).donnees;
  const libelleVente = useLibelleVente();
  return (
    <section>
      <EnTetePage
        titre="Encaissements"
        sousTitre="Vente, date, mode, montant et référence des encaissements de cette activité."
        actions={
          possedePermission(profil, 'encaissements', 'saisie') && (
            <Link to={`${BASE}/nouveau${filtres.vente_id ? `?vente_id=${filtres.vente_id}` : ''}`} className="bouton">
              Nouvel encaissement
            </Link>
          )
        }
      />
      {filtres.vente_id && (
        <div className="barre-filtres">
          <p className="texte-doux">
            Encaissements de la vente{' '}
            {vente ? <Link to={`/${espaceVente(profil, vente.activite)}/ventes/${vente._id}`}>{libelleVente(vente)}</Link> : 'Vente indisponible'}
          </p>
          <button type="button" className="bouton bouton--fantome-sombre" onClick={reinitialiser}>
            Tous les encaissements
          </button>
        </div>
      )}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des encaissements…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucun encaissement">
              <p>Les encaissements se saisissent depuis la fiche d’une vente validée ou avec « Nouvel encaissement ».</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionGroupee
                items={resultats.items}
                eligible={(ligne) => actionTransactionAutorisee('annuler', possedePermission(profil, 'encaissements', 'validation'), 'standard', ligne)}
                nom={(ligne) => `Encaissement du ${formaterDate(ligne.date_paiement)}`}
                action="Annuler les lignes"
                titre="Confirmer l’annulation"
                motif
                executer={encaissementService.annuler}
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
                          <th scope="col">Mode</th>
                          <th scope="col">Référence</th>
                          <th scope="col" className="nombre">Montant</th>
                          <th scope="col">Statut</th>
                          <th scope="col">Vente</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((encaissement) => (
                          <TableRow
                            key={encaissement._id}
                            selection={caseLigne(encaissement)}
                            actions={
                              <ActionsFiche
                                to={`${BASE}/${encaissement._id}`}
                                autres={optionsTransaction(`${BASE}/${encaissement._id}`, possedePermission(profil, 'encaissements', 'validation'), 'standard', encaissement)}
                                modifier={encaissement.statut === 'brouillon' && possedePermission(profil, 'encaissements', 'saisie')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${BASE}/${encaissement._id}`}>{formaterDate(encaissement.date_paiement)}</Link>
                            </th>
                            <td>{LIBELLES_ACTIVITES[encaissement.activite as 'production'] ?? encaissement.activite}</td>
                            <td>{LIBELLES_MODES[encaissement.mode]}</td>
                            <td>{encaissement.reference ?? '—'}</td>
                            <td className="nombre">{formaterMontant(encaissement.montant)}</td>
                            <td>
                              <PastilleStatut {...STATUTS_PRODUCTION[encaissement.statut]} />
                            </td>
                            <td>
                              <button type="button" className="bouton bouton--fantome-sombre bouton--petit" onClick={() => definir('vente_id', encaissement.vente_id)}>
                                Voir ses encaissements
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

/**
 * Enregistre puis, si demandé, valide. Après validation, la fiche de vente s'ouvre à jour ; après un refus,
 * le brouillon créé est réutilisé par l'envoi suivant.
 */
function useEnregistrement(idExistant?: string) {
  const BASE = useBase();
  const navigate = useNavigationEdition();
  const { profil } = useSession();
  const idCree = useRef<string | null>(idExistant ?? null);
  return async (donnees: DonneesEncaissement, valider: boolean, vente: Vente | undefined) => {
    let id = idCree.current;
    if (id) {
      const { vente_id: _vente, ...modifiables } = donnees;
      await encaissementService.modifier(id, modifiables);
    } else {
      id = (await encaissementService.creer(donnees))._id;
      idCree.current = id;
    }
    if (valider) {
      await encaissementService.valider(id);
      if (vente) {
        navigate(`/${espaceVente(profil, vente.activite)}/ventes/${vente._id}`, { state: { message: 'Encaissement validé : le solde de la vente est à jour.' } });
        return;
      }
    }
    navigate(`${BASE}/${id}`, { state: { message: valider ? 'Encaissement validé.' : 'Encaissement enregistré en brouillon.' } });
  };
}

export function EncaissementNouveauPage() {
  const BASE = useBase();
  const { profil } = useSession();
  const [parametres] = useSearchParams();
  const ventes = useVentesValidees(profil, useEspaceVente());
  const libelleVente = useLibelleVente();
  const enregistrer = useEnregistrement();
  const venteInitiale = parametres.get('vente_id') ?? undefined;
  const venteChoisie = ventes.find((vente) => vente._id === venteInitiale);
  return (
    <section className="page-etroite">
      <EnTetePage titre="Nouvel encaissement" />
      <EncaissementFormulaire
        ventes={ventes}
        libelleVente={libelleVente}
        venteInitiale={venteInitiale}
        peutValider={possedePermission(profil, 'encaissements', 'validation')}
        retour={venteChoisie ? `/${espaceVente(profil, venteChoisie.activite)}/ventes/${venteChoisie._id}` : BASE}
        onEnregistrer={enregistrer}
      />
    </section>
  );
}

/** /:activite/encaissements/:id/modifier : seul un brouillon se modifie ; la vente ne change pas. */
export function EncaissementModifierPage() {
  const BASE = useBase();
  const { id = '' } = useParams();
  const { profil } = useSession();
  const requete = useRequete((signal) => encaissementService.consulter(id, signal), [id]);
  const vente = useRequete((signal) => (requete.donnees ? venteService.consulter(requete.donnees.vente_id, signal) : Promise.resolve(null)), [requete.donnees?.vente_id]).donnees;
  const libelleVente = useLibelleVente();
  const enregistrer = useEnregistrement(id);
  return (
    <section className="page-etroite">
      <EnTetePage titre="Modifier l’encaissement" />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de l’encaissement…">
        {(encaissement) =>
          encaissement.statut !== 'brouillon' ? (
            <Alerte ton="attention" titre="Encaissement non modifiable">
              <p>Seul un brouillon se modifie. Un encaissement validé se corrige par annulation avec motif.</p>
              <Link to={`${BASE}/${id}`}>Retour à la fiche</Link>
            </Alerte>
          ) : (
            <EncaissementFormulaire
              encaissement={encaissement}
              ventes={vente ? [vente] : []}
              libelleVente={libelleVente}
              peutValider={possedePermission(profil, 'encaissements', 'validation')}
              retour={`${BASE}/${id}`}
              onEnregistrer={enregistrer}
            />
          )
        }
      </BlocRequete>
    </section>
  );
}

type Action = 'valider' | 'annuler';

/** /:activite/encaissements/:id : encaissement, situation de sa vente et actions selon le statut et les droits. */
export function EncaissementPage() {
  const BASE = useBase();
  const { id = '' } = useParams();
  const { profil } = useSession();
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const actionListe = useActionListe<Action>(['valider', 'annuler']);
  const [action, setAction] = useState<Action | null>(actionListe);
  const requete = useRequete((signal) => encaissementService.consulter(id, signal), [id]);
  const encaissement = requete.donnees;
  const vente = useRequete((signal) => (encaissement ? venteService.consulter(encaissement.vente_id, signal) : Promise.resolve(null)), [encaissement?.vente_id, encaissement?.updated_at]).donnees;
  const peutValider = possedePermission(profil, 'encaissements', 'validation');
  return (
    <section>
      <EnTetePage
        retour={{ to: encaissement ? `${BASE}?vente_id=${encaissement.vente_id}` : BASE, libelle: 'Encaissements de cette vente' }}
        titre={encaissement ? `Encaissement de ${formaterMontant(encaissement.montant)}` : 'Encaissement'}
        sousTitre={encaissement ? `${formaterDate(encaissement.date_paiement)} · ${LIBELLES_MODES[encaissement.mode]}` : undefined}
        actions={
          encaissement && (
            <>
              {encaissement.statut === 'brouillon' && possedePermission(profil, 'encaissements', 'saisie') && (
                <Link to={`${BASE}/${id}/modifier`} className="bouton bouton--secondaire">
                  Modifier
                </Link>
              )}
              {encaissement.statut === 'brouillon' && peutValider && (
                <button type="button" className="bouton" onClick={() => setAction('valider')}>
                  Valider
                </button>
              )}
              {encaissement.statut !== 'annulee' && peutValider && (
                <button type="button" className="bouton bouton--danger" onClick={() => setAction('annuler')}>
                  Annuler
                </button>
              )}
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      <BlocRequete {...requete} cartes={4} libelleChargement="Chargement de l’encaissement…">
        {(fiche) => (
          <>
            <SituationVenteCartes situation={fiche.vente} precisionTotal="Vente encaissée" />
            <div className="page-etroite">
              <FicheDonnees
                lignes={[
                  ['Statut', <PastilleStatut key="statut" {...STATUTS_PRODUCTION[fiche.statut]} />],
                  ['Vente', vente ? <Link key="vente" to={`/${espaceVente(profil, vente.activite)}/ventes/${vente._id}`}>Ouvrir la fiche de la vente</Link> : 'Vente indisponible'],
                  ['Montant', formaterMontant(fiche.montant)],
                  ['Date du paiement', formaterDate(fiche.date_paiement)],
                  ['Mode', LIBELLES_MODES[fiche.mode]],
                  ['Référence', fiche.reference],
                  ['Validé le', fiche.validated_at ? formaterDate(fiche.validated_at) : null],
                  ['Annulé le', fiche.annulee_at ? formaterDate(fiche.annulee_at) : null],
                  ['Motif d’annulation', fiche.motif_annulation],
                ]}
              />
            </div>
          </>
        )}
      </BlocRequete>
      {action && encaissement && actionTransactionAutorisee(action, peutValider, 'standard', encaissement) && (
        <DialogueAction
          titre={action === 'valider' ? 'Valider l’encaissement ?' : 'Annuler l’encaissement ?'}
          libelleConfirmer={action === 'valider' ? 'Valider' : 'Annuler l’encaissement'}
          danger={action === 'annuler'}
          motif={action === 'annuler'}
          onFermer={() => setAction(null)}
          onConfirmer={async (motif) => {
            try {
              if (action === 'valider') await encaissementService.valider(id);
              else await encaissementService.annuler(id, motif);
            } catch (cause) {
              if (codeErreur(cause) === 'montant_superieur_au_solde') {
                const solde = detailsErreur(cause).solde;
                throw new Error(`${messageErreur(cause)}${typeof solde === 'string' ? ` Solde dû : ${formaterMontant(solde)}.` : ''} L’encaissement reste en brouillon.`);
              }
              throw cause;
            }
            setAction(null);
            setMessage(action === 'valider' ? 'Encaissement validé : le solde de la vente est à jour.' : 'Encaissement annulé : son montant est retiré de l’encaissé.');
            requete.recharger();
          }}
        >
          <p>
            {action === 'valider'
              ? `${formaterMontant(encaissement.montant)} seront déduits du solde dû (${formaterMontant(encaissement.vente.solde)}).`
              : encaissement.statut === 'validee'
                ? 'L’encaissement reste dans l’historique ; son montant est retiré de l’encaissé de la vente.'
                : 'Le brouillon sera annulé et restera dans l’historique.'}
          </p>
        </DialogueAction>
      )}
    </section>
  );
}
