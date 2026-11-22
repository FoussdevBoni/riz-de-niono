import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { Link, useParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { EnTetePage } from '../../components/EnTetePage';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { useCampagnesReference } from '../../modules/production/campagnes-agricoles/hooks/useCampagnesAgricoles';
import { ProductionFormulaire } from '../../modules/production/productions/components/ProductionFormulaire';
import { productionService } from '../../modules/production/productions/services/productionService';
import { useSitesReference } from '../../modules/production/sites-production/hooks/useSitesProduction';
import { useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';

const BASE = '/production/productions';

/** /production/productions/:id/modifier : seul un brouillon se modifie (document 04). */
export function ProductionModifierPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const navigate = useNavigationEdition();
  const requete = useRequete((signal) => productionService.consulter(id, signal), [id]);
  const campagnes = useCampagnesReference(profil);
  const sites = useSitesReference(profil);
  const produits = useProduitsReference(profil, 'production');
  return (
    <section className="page-etroite">
      <EnTetePage titre="Modifier la récolte" />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement de la récolte…">
        {(production) =>
          production.statut !== 'brouillon' ? (
            <Alerte ton="attention" titre="Récolte non modifiable">
              <p>Seul un brouillon se modifie. Une récolte validée se corrige par annulation avec motif, puis nouvelle saisie.</p>
              <Link to={`${BASE}/${id}`}>Retour à la fiche</Link>
            </Alerte>
          ) : (
            <ProductionFormulaire
              production={production}
              campagnes={campagnes}
              sites={sites}
              produits={produits}
              retour={`${BASE}/${id}`}
              onEnregistrer={async (donnees) => {
                await productionService.modifier(id, donnees);
                navigate(`${BASE}/${id}`, { state: { message: 'Brouillon mis à jour.' } });
              }}
            />
          )
        }
      </BlocRequete>
    </section>
  );
}
