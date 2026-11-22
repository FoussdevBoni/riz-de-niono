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
import { useActiviteCourante } from '../../hooks/useActiviteCourante';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { libelleReference } from '../../hooks/useOptionsReference';
import { useRequete } from '../../hooks/useRequete';
import { useAchatsReglables } from '../../modules/achats/hooks/useAchats';
import { achatService } from '../../modules/achats/services/achatService';
import type { Achat } from '../../modules/achats/types/achatTypes';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { optionsFournisseurs, useFournisseursReference } from '../../modules/fournisseurs/hooks/useFournisseursReference';
import { STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { ReglementFournisseurFormulaire } from '../../modules/reglements-fournisseurs/components/ReglementFournisseurFormulaire';
import { reglementFournisseurService } from '../../modules/reglements-fournisseurs/services/reglementFournisseurService';
import type { DonneesReglementFournisseur } from '../../modules/reglements-fournisseurs/types/reglementFournisseurTypes';
import { LIBELLES_MODES } from '../../modules/reglements-fournisseurs/utils/libellesReglements';
import { formaterDate, formaterMontant } from '../../utils/formatage';

const FILTRES = ['achat_id', 'page'] as const;

function useBase() {
  return `/${useActiviteCourante()}/reglements-fournisseurs`;
}

/** Libellé d'un achat : fournisseur, date et total. */
function useLibelleAchat() {
  const { profil } = useSession();
  const fournisseurs = optionsFournisseurs(useFournisseursReference(profil));
  return (achat: Achat) => `${libelleReference(fournisseurs, achat.fournisseur_id, 'Nom du fournisseur indisponible')} · ${formaterDate(achat.date_achat)} · ${formaterMontant(achat.montant_total)}`;
}

/**
 * /:activite/reglements-fournisseurs : règlements de l'activité ouverte (ils suivent la visibilité de leur achat),
 * filtre achat_id depuis la fiche d'un achat.
 */
export function ReglementsFournisseursPage() {
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const base = useBase();
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const requete = useRequete(
    (signal) => reglementFournisseurService.lister({ activite, achat_id: filtres.achat_id, page, taille_page: 25 }, signal),
    [activite, filtres.achat_id, page],
  );
  const achatFiltre = useRequete(
    (signal) => (filtres.achat_id ? achatService.consulter(filtres.achat_id, signal) : Promise.resolve(null)),
    [filtres.achat_id],
  ).donnees;
  const libelleAchat = useLibelleAchat();

  return (
    <section>
      <EnTetePage
        titre="Règlements fournisseurs"
        sousTitre="Paiements des achats, leur statut et le solde dû."
        actions={
          possedePermission(profil, 'reglements_fournisseurs', 'saisie') && (
            <Link to={`${base}/nouveau${filtres.achat_id ? `?achat_id=${filtres.achat_id}` : ''}`} className="bouton">
              Nouveau règlement
            </Link>
          )
        }
      />
      {filtres.achat_id && (
        <div className="barre-filtres">
          <p className="texte-doux">
            Règlements de l’achat{' '}
            <Link to={`/${activite}/achats/${filtres.achat_id}`}>{achatFiltre ? libelleAchat(achatFiltre) : 'Achat indisponible'}</Link>
            {achatFiltre && <> · solde dû {formaterMontant(achatFiltre.solde_restant)}</>}
          </p>
          <button type="button" className="bouton bouton--fantome-sombre" onClick={reinitialiser}>
            Tous les règlements
          </button>
        </div>
      )}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des règlements…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucun règlement">
              <p>Les règlements se saisissent depuis la fiche d’un achat validé ou avec « Nouveau règlement ».</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionGroupee
                items={resultats.items}
                eligible={(ligne) => actionTransactionAutorisee('annuler', possedePermission(profil, 'reglements_fournisseurs', 'validation'), 'standard', ligne)}
                nom={(ligne) => `Règlement du ${formaterDate(ligne.date_paiement)}`}
                action="Annuler les lignes"
                titre="Confirmer l’annulation"
                motif
                executer={reglementFournisseurService.annuler}
                actualiser={requete.recharger}
              >
                {({ entete, caseLigne }) => (
                  <div className="tableau-defilant">
                    <table className="tableau">
                      <thead>
                        <tr>
                          {entete && <th scope="col" className="colonne-selection">{entete}</th>}
                          <th scope="col">Date</th>
                          <th scope="col">Mode</th>
                          <th scope="col">Référence</th>
                          <th scope="col" className="nombre">Montant</th>
                          <th scope="col">Statut</th>
                          <th scope="col">Achat</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((reglement) => (
                          <TableRow
                            key={reglement._id}
                            selection={caseLigne(reglement)}
                            actions={
                              <ActionsFiche
                                to={`${base}/${reglement._id}`}
                                autres={optionsTransaction(`${base}/${reglement._id}`, possedePermission(profil, 'reglements_fournisseurs', 'validation'), 'standard', reglement)}
                                modifier={reglement.statut === 'brouillon' && possedePermission(profil, 'reglements_fournisseurs', 'saisie')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${base}/${reglement._id}`}>{formaterDate(reglement.date_paiement)}</Link>
                            </th>
                            <td>{LIBELLES_MODES[reglement.mode]}</td>
                            <td>{reglement.reference ?? '—'}</td>
                            <td className="nombre">{formaterMontant(reglement.montant)}</td>
                            <td>
                              <PastilleStatut {...STATUTS_PRODUCTION[reglement.statut]} />
                            </td>
                            <td>
                              <button type="button" className="bouton bouton--fantome-sombre bouton--petit" onClick={() => definir('achat_id', reglement.achat_id)}>
                                Voir ses règlements
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
 * Enregistre puis, si demandé, valide. Après un refus de validation, le brouillon créé est réutilisé
 * par l'envoi suivant (pas de second règlement).
 */
function useEnregistrement(base: string, idExistant?: string) {
  const navigate = useNavigationEdition();
  const idCree = useRef<string | null>(idExistant ?? null);
  return async (donnees: DonneesReglementFournisseur, valider: boolean) => {
    let id = idCree.current;
    if (id) {
      const { achat_id: _achat, ...modifiables } = donnees;
      await reglementFournisseurService.modifier(id, modifiables);
    } else {
      id = (await reglementFournisseurService.creer(donnees))._id;
      idCree.current = id;
    }
    if (valider) await reglementFournisseurService.valider(id);
    navigate(`${base}/${id}`, { state: { message: valider ? 'Règlement validé : le solde de l’achat est à jour.' : 'Règlement enregistré en brouillon.' } });
  };
}

export function ReglementFournisseurNouveauPage() {
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const base = useBase();
  const [parametres] = useSearchParams();
  const achats = useAchatsReglables(profil, activite);
  const libelleAchat = useLibelleAchat();
  const enregistrer = useEnregistrement(base);
  const achatInitial = parametres.get('achat_id') ?? undefined;
  return (
    <section className="page-etroite">
      <EnTetePage titre="Nouveau règlement fournisseur" />
      <ReglementFournisseurFormulaire
        achats={achats}
        libelleAchat={libelleAchat}
        achatInitial={achatInitial}
        peutValider={possedePermission(profil, 'reglements_fournisseurs', 'validation')}
        retour={achatInitial ? `/${activite}/achats/${achatInitial}` : base}
        onEnregistrer={enregistrer}
      />
    </section>
  );
}

/** /:activite/reglements-fournisseurs/:id/modifier : seul un brouillon se modifie ; l'achat ne change pas. */
export function ReglementFournisseurModifierPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const base = useBase();
  const requete = useRequete((signal) => reglementFournisseurService.consulter(id, signal), [id]);
  const achat = useRequete((signal) => (requete.donnees ? achatService.consulter(requete.donnees.achat_id, signal) : Promise.resolve(null)), [
    requete.donnees?.achat_id,
  ]).donnees;
  const libelleAchat = useLibelleAchat();
  const enregistrer = useEnregistrement(base, id);
  return (
    <section className="page-etroite">
      <EnTetePage titre="Modifier le règlement" />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du règlement…">
        {(reglement) =>
          reglement.statut !== 'brouillon' ? (
            <Alerte ton="attention" titre="Règlement non modifiable">
              <p>Seul un brouillon se modifie. Un règlement validé se corrige par annulation avec motif.</p>
              <Link to={`${base}/${id}`}>Retour à la fiche</Link>
            </Alerte>
          ) : (
            <ReglementFournisseurFormulaire
              reglement={reglement}
              achats={achat ? [achat] : []}
              libelleAchat={libelleAchat}
              peutValider={possedePermission(profil, 'reglements_fournisseurs', 'validation')}
              retour={`${base}/${id}`}
              onEnregistrer={enregistrer}
            />
          )
        }
      </BlocRequete>
    </section>
  );
}
