import { useParams } from 'react-router';

import { ReferentielCreation, ReferentielModification } from '../../components/referentiel/ReferentielEdition';
import { ReferentielFiche } from '../../components/referentiel/ReferentielFiche';
import { ReferentielListe } from '../../components/referentiel/ReferentielListe';
import { useActiviteCourante } from '../../hooks/useActiviteCourante';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { typeDepenseService } from '../../modules/types-depenses/services/typeDepenseService';
import { CODE_ENTRETIEN_MATERIEL } from '../../modules/types-depenses/types/typeDepenseTypes';

function useBase() {
  return `/${useActiviteCourante()}/types-depenses`;
}

const estReference = (element: { code: string }) => element.code === CODE_ENTRETIEN_MATERIEL;

/** /:activite/types-depenses : référentiel commun aux trois activités, filtre actif. */
export function TypesDepensesPage() {
  const { profil } = useSession();
  return (
    <ReferentielListe
      titre="Types de dépenses"
      sousTitre="Code, nom et état ; le type « Entretien du matériel » est un type de référence."
      base={useBase()}
      libelleNouveau="Nouveau type"
      peutCreer={possedePermission(profil, 'types_depenses', 'saisie')}
      basculerActif={(id, actif) => typeDepenseService.modifier(id, { actif })}
      protege={estReference}
      lister={typeDepenseService.lister}
      creer={typeDepenseService.creer}
      proposerCode={typeDepenseService.proposerCode}
      aideCode="Par exemple CARBURANT."
    />
  );
}

export function TypeDepenseNouveauPage() {
  return <ReferentielCreation titre="Nouveau type de dépense" base={useBase()} aideCode="Par exemple CARBURANT." creer={typeDepenseService.creer}
      proposerCode={typeDepenseService.proposerCode} />;
}

/** Le type de référence garde son code (409 type_reference sinon) ; son nom reste modifiable. */
export function TypeDepenseModifierPage() {
  const { id = '' } = useParams();
  return (
    <ReferentielModification
      id={id}
      titre="Modifier le type de dépense"
      base={useBase()}
      consulter={typeDepenseService.consulter}
      modifier={typeDepenseService.modifier}
      codeProtege={estReference}
    />
  );
}

export function TypeDepensePage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  return (
    <ReferentielFiche
      id={id}
      titreDefaut="Type de dépense"
      nature="ce type de dépense"
      base={useBase()}
      libelleRetour="Retour aux types de dépenses"
      peutSaisir={possedePermission(profil, 'types_depenses', 'saisie')}
      consulter={typeDepenseService.consulter}
      basculerActif={(identifiant, actif) => typeDepenseService.modifier(identifiant, { actif })}
      protection={(element) =>
        estReference(element) ? 'Type de référence utilisé pour l’entretien du matériel : il ne se recode pas et ne s’archive pas.' : null
      }
    />
  );
}
