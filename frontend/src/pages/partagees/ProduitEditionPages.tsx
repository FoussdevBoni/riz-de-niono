import { useNavigationEdition } from '../../hooks/useNavigationEdition';
import { useParams } from 'react-router';

import { BlocRequete } from '../../components/BlocRequete';
import { EnTetePage } from '../../components/EnTetePage';
import { useActiviteCourante } from '../../hooks/useActiviteCourante';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { useCategoriesReference } from '../../modules/categories-produits/hooks/useCategoriesReference';
import { ProduitFormulaire } from '../../modules/produits/components/ProduitFormulaire';
import { produitService } from '../../modules/produits/services/produitService';

/** /:activite/produits/nouveau : l'usage de l'espace ouvert est proposé par défaut. */
export function ProduitNouveauPage() {
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const navigate = useNavigationEdition();
  const categories = useCategoriesReference(profil);
  const base = `/${activite}/produits`;
  return (
    <section className="page-etroite">
      <EnTetePage titre="Nouveau produit" />
      <ProduitFormulaire
        categories={categories}
        activitesProfil={profil?.activites ?? []}
        activiteParDefaut={activite}
        retour={base}
        onEnregistrer={async (donnees) => {
          const produit = await produitService.creer(donnees);
          navigate(`${base}/${produit._id}`, { state: { message: 'Produit créé.' } });
        }}
      />
    </section>
  );
}

/** /:activite/produits/:id/modifier. */
export function ProduitModifierPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const navigate = useNavigationEdition();
  const categories = useCategoriesReference(profil);
  const requete = useRequete((signal) => produitService.consulter(id, signal), [id]);
  const base = `/${activite}/produits`;
  return (
    <section className="page-etroite">
      <EnTetePage titre="Modifier le produit" sousTitre={requete.donnees ? `${requete.donnees.nom} (${requete.donnees.code})` : undefined} />
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du produit…">
        {(produit) => (
          <ProduitFormulaire
            produit={produit}
            categories={categories}
            activitesProfil={profil?.activites ?? []}
            activiteParDefaut={activite}
            retour={`${base}/${id}`}
            onEnregistrer={async (donnees) => {
              await produitService.modifier(id, donnees);
              navigate(`${base}/${id}`, { state: { message: 'Modifications enregistrées.' } });
            }}
          />
        )}
      </BlocRequete>
    </section>
  );
}
