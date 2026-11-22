import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { EnTetePage } from '../../components/EnTetePage';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import type { Profil } from '../../modules/profil/types/profilTypes';
import { useCampagnesReference } from '../../modules/production/campagnes-agricoles/hooks/useCampagnesAgricoles';
import { useEquipesReference } from '../../modules/production/equipes-production/hooks/useEquipesReference';
import { OperationAgricoleFormulaire } from '../../modules/production/operations-agricoles/components/OperationAgricoleFormulaire';
import { operationAgricoleService } from '../../modules/production/operations-agricoles/services/operationAgricoleService';
import type { DonneesOperationAgricole } from '../../modules/production/operations-agricoles/types/operationAgricoleTypes';
import { useSitesReference } from '../../modules/production/sites-production/hooks/useSitesProduction';
import { useTypesOperationsReference } from '../../modules/production/types-operations-agricoles/hooks/useTypesOperationsReference';
import { useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';
import { useStocksDisponibles } from '../../modules/stock/hooks/useStocksDisponibles';

const BASE = '/production/operations-agricoles';

/** Listes de référence du formulaire, chacune chargée par le service de son module. */
function useReferencesTravail(profil: Profil | null) {
  return {
    campagnes: useCampagnesReference(profil),
    sites: useSitesReference(profil),
    types: useTypesOperationsReference(profil),
    equipes: useEquipesReference(profil),
    produits: useProduitsReference(profil, 'production'),
    stocks: useStocksDisponibles(possedePermission(profil, 'stock')),
  };
}

/**
 * Enregistre puis, si demandé, valide. Le brouillon créé est mémorisé : après un refus de validation
 * (stock insuffisant), un nouvel envoi modifie ce brouillon au lieu d'en créer un second.
 */
function useEnregistrement(idExistant?: string) {
  const navigate = useNavigationEdition();
  const idCree = useRef<string | null>(idExistant ?? null);
  return async (donnees: DonneesOperationAgricole, valider: boolean) => {
    let id = idCree.current;
    if (id) await operationAgricoleService.modifier(id, donnees);
    else {
      id = (await operationAgricoleService.creer(donnees))._id;
      idCree.current = id;
    }
    if (valider) await operationAgricoleService.valider(id);
    navigate(`${BASE}/${id}`, {
      state: { message: valider ? 'Travail validé : les intrants sont sortis du stock.' : 'Travail enregistré en brouillon.' },
    });
  };
}

/** /production/operations-agricoles/nouveau : saisie d'un travail en brouillon, avec validation possible. */
export function OperationAgricoleNouveauPage() {
  const { profil } = useSession();
  const [parametres] = useSearchParams();
  const references = useReferencesTravail(profil);
  const enregistrer = useEnregistrement();
  return (
    <section>
      <EnTetePage titre="Saisir un travail agricole" sousTitre="La validation sort les intrants déclarés du stock." />
      <OperationAgricoleFormulaire
        {...references}
        campagneInitiale={parametres.get('campagne_id') ?? undefined}
        peutValider={possedePermission(profil, 'operations_agricoles', 'validation')}
        retour={BASE}
        onEnregistrer={enregistrer}
      />
    </section>
  );
}

/** /production/operations-agricoles/:id/modifier : seul un brouillon se modifie. */
export function OperationAgricoleModifierPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const requete = useRequete((signal) => operationAgricoleService.consulter(id, signal), [id]);
  const references = useReferencesTravail(profil);
  const enregistrer = useEnregistrement(id);
  return (
    <section>
      <EnTetePage titre="Modifier le travail" />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du travail…">
        {(operation) =>
          operation.statut !== 'brouillon' ? (
            <Alerte ton="attention" titre="Travail non modifiable">
              <p>Seul un brouillon se modifie. Un travail validé se corrige par annulation avec motif, puis nouvelle saisie.</p>
              <Link to={`${BASE}/${id}`}>Retour à la fiche</Link>
            </Alerte>
          ) : (
            <OperationAgricoleFormulaire
              {...references}
              operation={operation}
              peutValider={possedePermission(profil, 'operations_agricoles', 'validation')}
              retour={`${BASE}/${id}`}
              onEnregistrer={enregistrer}
            />
          )
        }
      </BlocRequete>
    </section>
  );
}
