import { useParams } from 'react-router';

import { ReferentielCreation, ReferentielModification } from '../../components/referentiel/ReferentielEdition';
import { ReferentielFiche } from '../../components/referentiel/ReferentielFiche';
import { ReferentielListe } from '../../components/referentiel/ReferentielListe';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { typeOperationAgricoleService } from '../../modules/production/types-operations-agricoles/services/typeOperationAgricoleService';

const BASE = '/production/types-operations-agricoles';

/** /production/types-operations-agricoles : référentiel des travaux (labour, repiquage, épandage…). */
export function TypesOperationsAgricolesPage() {
  const { profil } = useSession();
  return (
    <ReferentielListe
      titre="Types d’opérations agricoles"
      sousTitre="Référentiel des travaux proposés lors de la saisie d’une opération."
      base={BASE}
      libelleNouveau="Nouveau type"
      peutCreer={possedePermission(profil, 'types_operations_agricoles', 'saisie')}
      basculerActif={(id, actif) => typeOperationAgricoleService.modifier(id, { actif })}
      lister={typeOperationAgricoleService.lister}
      creer={typeOperationAgricoleService.creer}
      proposerCode={typeOperationAgricoleService.proposerCode}
      aideCode="Par exemple LABOUR."
    />
  );
}

export function TypeOperationAgricoleNouveauPage() {
  return <ReferentielCreation titre="Nouveau type d’opération" base={BASE} aideCode="Par exemple LABOUR." creer={typeOperationAgricoleService.creer}
      proposerCode={typeOperationAgricoleService.proposerCode} />;
}

export function TypeOperationAgricoleModifierPage() {
  const { id = '' } = useParams();
  return (
    <ReferentielModification
      id={id}
      titre="Modifier le type d’opération"
      base={BASE}
      consulter={typeOperationAgricoleService.consulter}
      modifier={typeOperationAgricoleService.modifier}
    />
  );
}

export function TypeOperationAgricolePage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  return (
    <ReferentielFiche
      id={id}
      titreDefaut="Type d’opération agricole"
      nature="ce type d’opération"
      base={BASE}
      libelleRetour="Retour aux types d’opérations"
      peutSaisir={possedePermission(profil, 'types_operations_agricoles', 'saisie')}
      consulter={typeOperationAgricoleService.consulter}
      basculerActif={(identifiant, actif) => typeOperationAgricoleService.modifier(identifiant, { actif })}
    />
  );
}
