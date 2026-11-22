import ActionGroupee from '../../components/ActionGroupee';
import { actionTransactionAutorisee, optionsTransaction, useActionListe } from '../../components/ActionsTransaction';
import { ActionsFiche } from '../../components/MenuModal';
import TableRow from '../../components/TableRow';

import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { DialogueAction } from '../../components/DialogueAction';
import { EnTetePage } from '../../components/EnTetePage';
import { EtatVide } from '../../components/EtatVide';
import { FicheDonnees } from '../../components/FicheDonnees';
import { Pagination } from '../../components/Pagination';
import { PastilleStatut } from '../../components/PastilleStatut';
import { SelectFiltre } from '../../components/SelectFiltre';
import { useActiviteCourante } from '../../hooks/useActiviteCourante';
import { useFiltresUrl } from '../../hooks/useFiltresUrl';
import { useMessageNavigation } from '../../hooks/useMessageNavigation';
import { libelleReference } from '../../hooks/useOptionsReference';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { DepenseFormulaire } from '../../modules/depenses/components/DepenseFormulaire';
import { JustificatifDepense } from '../../modules/depenses/components/JustificatifDepense';
import { depenseService } from '../../modules/depenses/services/depenseService';
import { useMaterielsReference } from '../../modules/materiels/hooks/useMaterielsReference';
import { optionsCampagnes, useCampagnesReference } from '../../modules/production/campagnes-agricoles/hooks/useCampagnesAgricoles';
import { STATUTS_PRODUCTION } from '../../modules/production/productions/utils/statutProduction';
import { optionsSites, useSitesReference } from '../../modules/production/sites-production/hooks/useSitesProduction';
import type { Activite, Profil } from '../../modules/profil/types/profilTypes';
import { useUnitesReference } from '../../modules/transformation/unites-transformation/hooks/useUnitesReference';
import { useTypesDepensesReference } from '../../modules/types-depenses/hooks/useTypesDepensesReference';
import { formaterDate, formaterMontant } from '../../utils/formatage';

const FILTRES = ['type_depense_id', 'campagne_id', 'site_id', 'page'] as const;

/** Listes de référence d'une dépense ; les rattachements ne sont chargés que pour l'activité concernée. */
function useReferencesDepense(profil: Profil | null, activite: Activite) {
  const production = activite === 'production' ? profil : null;
  return {
    types: useTypesDepensesReference(profil),
    materiels: useMaterielsReference(profil, activite),
    campagnes: useCampagnesReference(production),
    sites: useSitesReference(production),
    unites: useUnitesReference(activite === 'transformation' ? profil : null),
  };
}

/** /:activite/depenses : dépenses de l'activité ouverte ; en production, filtres campagne et site en plus du type. */
export function DepensesPage() {
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const base = `/${activite}/depenses`;
  const { filtres, definir, reinitialiser } = useFiltresUrl(FILTRES);
  const page = Number(filtres.page ?? 1);
  const enProduction = activite === 'production';
  const requete = useRequete(
    (signal) =>
      depenseService.lister(
        {
          activite,
          type_depense_id: filtres.type_depense_id,
          campagne_id: enProduction ? filtres.campagne_id : undefined,
          site_id: enProduction ? filtres.site_id : undefined,
          page,
          taille_page: 25,
        },
        signal,
      ),
    [activite, filtres.type_depense_id, filtres.campagne_id, filtres.site_id, page],
  );
  const references = useReferencesDepense(profil, activite);
  const types = references.types.map((type) => ({ valeur: type._id, libelle: type.nom }));
  const campagnes = optionsCampagnes(references.campagnes);
  const sites = optionsSites(references.sites);
  const filtre = Boolean(filtres.type_depense_id || filtres.campagne_id || filtres.site_id);
  return (
    <section>
      <EnTetePage
        titre="Dépenses"
        sousTitre={enProduction ? 'Type, montant, date, site et campagne des dépenses de production.' : 'Type, montant, date et affectation des dépenses de l’activité.'}
        actions={
          possedePermission(profil, 'depenses', 'saisie') && (
            <Link to={`${base}/nouveau`} className="bouton">
              Nouvelle dépense
            </Link>
          )
        }
      />
      <div className="barre-filtres" role="search" aria-label="Filtres des dépenses">
        {types.length > 0 && <SelectFiltre libelle="Type" libelleTous="Tous les types" valeur={filtres.type_depense_id ?? ''} options={types} onChange={(valeur) => definir('type_depense_id', valeur)} />}
        {enProduction && campagnes.length > 0 && (
          <SelectFiltre libelle="Campagne" libelleTous="Toutes les campagnes" valeur={filtres.campagne_id ?? ''} options={campagnes} onChange={(valeur) => definir('campagne_id', valeur)} />
        )}
        {enProduction && sites.length > 0 && <SelectFiltre libelle="Site" libelleTous="Tous les sites" valeur={filtres.site_id ?? ''} options={sites} onChange={(valeur) => definir('site_id', valeur)} />}
        {filtre && (
          <button type="button" className="bouton bouton--fantome-sombre" onClick={reinitialiser}>
            Effacer les filtres
          </button>
        )}
      </div>
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement des dépenses…">
        {(resultats) =>
          resultats.items.length === 0 ? (
            <EtatVide titre="Aucune dépense">
              <p>{filtre ? 'Aucune dépense ne correspond à ces filtres.' : 'Les dépenses de cette activité apparaîtront ici.'}</p>
            </EtatVide>
          ) : (
            <div className="panneau">
              <ActionGroupee
                items={resultats.items}
                eligible={(ligne) => actionTransactionAutorisee('annuler', possedePermission(profil, 'depenses', 'validation'), 'standard', ligne)}
                nom={(ligne) => `Dépense du ${formaterDate(ligne.date_depense)}`}
                action="Annuler les lignes"
                titre="Confirmer l’annulation"
                motif
                executer={depenseService.annuler}
                actualiser={requete.recharger}
              >
                {({ entete, caseLigne }) => (
                  <div className="tableau-defilant">
                    <table className="tableau">
                      <thead>
                        <tr>
                          {entete && <th scope="col" className="colonne-selection">{entete}</th>}
                          <th scope="col">Date</th>
                          <th scope="col">Libellé</th>
                          <th scope="col">Type</th>
                          {enProduction && <th scope="col">Site</th>}
                          <th scope="col" className="nombre">Montant</th>
                          <th scope="col">Justificatif</th>
                          <th scope="col">Statut</th>
                          <th scope="col" className="colonne-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultats.items.map((depense) => (
                          <TableRow
                            key={depense._id}
                            selection={caseLigne(depense)}
                            actions={
                              <ActionsFiche
                                to={`${base}/${depense._id}`}
                                autres={optionsTransaction(`${base}/${depense._id}`, possedePermission(profil, 'depenses', 'validation'), 'standard', depense)}
                                modifier={depense.statut === 'brouillon' && possedePermission(profil, 'depenses', 'saisie')}
                              />
                            }
                          >
                            <th scope="row">
                              <Link to={`${base}/${depense._id}`}>{formaterDate(depense.date_depense)}</Link>
                            </th>
                            <td>{depense.libelle}</td>
                            <td>{libelleReference(types, depense.type_depense_id, 'Type de dépense indisponible')}</td>
                            {enProduction && <td>{libelleReference(sites, depense.site_id, 'Nom du site indisponible')}</td>}
                            <td className="nombre">{formaterMontant(depense.montant)}</td>
                            <td>{depense.justificatif ? 'Oui' : '—'}</td>
                            <td>
                              <PastilleStatut {...STATUTS_PRODUCTION[depense.statut]} />
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

export function DepenseNouveauPage() {
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const base = `/${activite}/depenses`;
  const navigate = useNavigationEdition();
  const references = useReferencesDepense(profil, activite);
  return (
    <section>
      <EnTetePage titre="Nouvelle dépense" sousTitre="La dépense est enregistrée en brouillon ; le justificatif se joint depuis sa fiche." />
      <DepenseFormulaire
        {...references}
        activite={activite}
        retour={base}
        onEnregistrer={async (donnees) => {
          const depense = await depenseService.creer(donnees);
          navigate(`${base}/${depense._id}`, { state: { message: 'Dépense enregistrée en brouillon : joignez le justificatif ci-dessous.' } });
        }}
      />
    </section>
  );
}

/** /:activite/depenses/:id/modifier : seul un brouillon se modifie. */
export function DepenseModifierPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const base = `/${activite}/depenses`;
  const navigate = useNavigationEdition();
  const requete = useRequete((signal) => depenseService.consulter(id, signal), [id]);
  const references = useReferencesDepense(profil, requete.donnees?.activite ?? activite);
  return (
    <section>
      <EnTetePage titre="Modifier la dépense" />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de la dépense…">
        {(depense) =>
          depense.statut !== 'brouillon' ? (
            <Alerte ton="attention" titre="Dépense non modifiable">
              <p>Seul un brouillon se modifie. Une dépense validée se corrige par annulation avec motif.</p>
              <Link to={`${base}/${id}`}>Retour à la fiche</Link>
            </Alerte>
          ) : (
            <DepenseFormulaire
              {...references}
              depense={depense}
              activite={depense.activite}
              retour={`${base}/${id}`}
              onEnregistrer={async (donnees) => {
                const { activite: _activite, ...modifiables } = donnees;
                await depenseService.modifier(id, modifiables);
                navigate(`${base}/${id}`, { state: { message: 'Brouillon mis à jour.' } });
              }}
            />
          )
        }
      </BlocRequete>
    </section>
  );
}

type Action = 'valider' | 'annuler';

/**
 * /:activite/depenses/:id : fiche, justificatif et actions. Validation (brouillon) et annulation avec motif
 * (brouillon ou validée) exigent l'action validation ; une dépense annulée reste dans l'historique et sort des totaux.
 */
export function DepensePage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const base = `/${activite}/depenses`;
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const actionListe = useActionListe<Action>(['valider', 'annuler']);
  const [action, setAction] = useState<Action | null>(actionListe);
  const requete = useRequete((signal) => depenseService.consulter(id, signal), [id]);
  const depense = requete.donnees;
  const references = useReferencesDepense(profil, depense?.activite ?? activite);
  const peutValider = possedePermission(profil, 'depenses', 'validation');
  const peutSaisir = possedePermission(profil, 'depenses', 'saisie');
  const types = references.types.map((type) => ({ valeur: type._id, libelle: type.nom }));

  return (
    <section>
      <EnTetePage
        retour={{ to: base, libelle: 'Retour aux dépenses' }}
        titre={depense?.libelle ?? 'Dépense'}
        sousTitre={depense ? `${formaterDate(depense.date_depense)} · ${formaterMontant(depense.montant)}` : undefined}
        actions={
          depense && (
            <>
              {depense.statut === 'brouillon' && peutSaisir && (
                <Link to={`${base}/${id}/modifier`} className="bouton bouton--secondaire">
                  Modifier
                </Link>
              )}
              {depense.statut === 'brouillon' && peutValider && (
                <button type="button" className="bouton" onClick={() => setAction('valider')}>
                  Valider
                </button>
              )}
              {depense.statut !== 'annulee' && peutValider && (
                <button type="button" className="bouton bouton--danger" onClick={() => setAction('annuler')}>
                  Annuler
                </button>
              )}
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de la dépense…">
        {(fiche) => (
          <div className="page-etroite">
            <FicheDonnees
              lignes={[
                ['Statut', <PastilleStatut key="statut" {...STATUTS_PRODUCTION[fiche.statut]} />],
                ['Libellé', fiche.libelle],
                ['Type', libelleReference(types, fiche.type_depense_id, 'Type de dépense indisponible')],
                ['Montant', formaterMontant(fiche.montant)],
                ['Date', formaterDate(fiche.date_depense)],
                ...(fiche.activite === 'production'
                  ? ([
                      ['Campagne', libelleReference(optionsCampagnes(references.campagnes), fiche.campagne_id, 'Nom de la campagne indisponible')],
                      ['Site', libelleReference(optionsSites(references.sites), fiche.site_id, 'Nom du site indisponible')],
                    ] as [string, string][])
                  : []),
                ...(fiche.activite === 'transformation'
                  ? ([['Unité', fiche.unite_transformation_id ? (references.unites.find((u) => u._id === fiche.unite_transformation_id)?.nom ?? null) : null]] as [string, string | null][])
                  : []),
                ['Matériel', fiche.materiel_id ? (references.materiels.find((m) => m._id === fiche.materiel_id)?.nom ?? 'Nom du matériel indisponible') : null],
                ['Validée le', fiche.validated_at ? formaterDate(fiche.validated_at) : null],
                ['Annulée le', fiche.annulee_at ? formaterDate(fiche.annulee_at) : null],
                ['Motif d’annulation', fiche.motif_annulation],
              ]}
            />
            <JustificatifDepense
              depense={fiche}
              peutSaisir={peutSaisir}
              onJoindre={async (fichier) => {
                await depenseService.joindreJustificatif(id, fichier);
                setMessage('Justificatif enregistré.');
                requete.recharger();
              }}
              onRetirer={async () => {
                await depenseService.retirerJustificatif(id);
                setMessage('Justificatif retiré.');
                requete.recharger();
              }}
            />
          </div>
        )}
      </BlocRequete>
      {action && depense && actionTransactionAutorisee(action, peutValider, 'standard', depense) && (
        <DialogueAction
          titre={action === 'valider' ? 'Valider la dépense ?' : 'Annuler la dépense ?'}
          libelleConfirmer={action === 'valider' ? 'Valider' : 'Annuler la dépense'}
          danger={action === 'annuler'}
          motif={action === 'annuler'}
          onFermer={() => setAction(null)}
          onConfirmer={async (motif) => {
            if (action === 'valider') await depenseService.valider(id);
            else await depenseService.annuler(id, motif);
            setAction(null);
            setMessage(action === 'valider' ? 'Dépense validée : elle entre dans les totaux des tableaux de bord.' : 'Dépense annulée : elle reste dans l’historique et sort des totaux.');
            requete.recharger();
          }}
        >
          <p>
            {action === 'valider'
              ? `${formaterMontant(depense.montant)} seront comptés dans les dépenses enregistrées. La dépense ne sera plus modifiable.`
              : 'La dépense reste dans l’historique avec son justificatif et sort des totaux. Elle n’a aucun effet de stock.'}
          </p>
        </DialogueAction>
      )}
    </section>
  );
}
