import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { useSearchParams } from 'react-router';

import { EnTetePage } from '../../components/EnTetePage';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { useCampagnesReference } from '../../modules/production/campagnes-agricoles/hooks/useCampagnesAgricoles';
import { ProductionFormulaire } from '../../modules/production/productions/components/ProductionFormulaire';
import { productionService } from '../../modules/production/productions/services/productionService';
import { useSitesReference } from '../../modules/production/sites-production/hooks/useSitesProduction';
import { useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';

const BASE = '/production/productions';

/** /production/productions/nouveau : saisie d'une récolte en brouillon. */
export function ProductionNouveauPage() {
  const { profil } = useSession();
  const navigate = useNavigationEdition();
  const [parametres] = useSearchParams();
  const campagnes = useCampagnesReference(profil);
  const sites = useSitesReference(profil);
  const produits = useProduitsReference(profil, 'production');
  return (
    <section className="page-etroite">
      <EnTetePage titre="Saisir une récolte" sousTitre="La récolte est enregistrée en brouillon ; sa validation ajoute la quantité au stock." />
      <ProductionFormulaire
        campagnes={campagnes}
        sites={sites}
        produits={produits}
        campagneInitiale={parametres.get('campagne_id') ?? undefined}
        retour={BASE}
        onEnregistrer={async (donnees) => {
          const production = await productionService.creer(donnees);
          navigate(`${BASE}/${production._id}`, { state: { message: 'Récolte enregistrée en brouillon.' } });
        }}
      />
    </section>
  );
}
