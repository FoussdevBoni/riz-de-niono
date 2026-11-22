import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { BoutonArchivage } from '../../components/BoutonArchivage';
import { EnTetePage } from '../../components/EnTetePage';
import { FicheDonnees } from '../../components/FicheDonnees';
import { PastilleStatut } from '../../components/PastilleStatut';
import { useActiviteCourante } from '../../hooks/useActiviteCourante';
import { useMessageNavigation } from '../../hooks/useMessageNavigation';
import { libelleReference } from '../../hooks/useOptionsReference';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { optionsCategories, useCategoriesReference } from '../../modules/categories-produits/hooks/useCategoriesReference';
import { produitService } from '../../modules/produits/services/produitService';
import { LIBELLES_ACTIVITES } from '../../modules/produits/utils/libellesProduits';
import { formaterDate, formaterMontant } from '../../utils/formatage';

/** /:activite/produits/:id : fiche produit, modification et archivage avec le droit saisie. */
export function ProduitPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const base = `/${activite}/produits`;
  const messageInitial = useMessageNavigation();
  const [message, setMessage] = useState(messageInitial);
  const requete = useRequete((signal) => produitService.consulter(id, signal), [id]);
  const categories = optionsCategories(useCategoriesReference(profil));
  const produit = requete.donnees;
  const peutSaisir = possedePermission(profil, 'produits', 'saisie');

  return (
    <section className="page-etroite">
      <EnTetePage
        retour={{ to: base, libelle: 'Retour aux produits' }}
        titre={produit?.nom ?? 'Produit'}
        sousTitre={produit?.code}
        actions={
          produit &&
          peutSaisir && (
            <>
              <Link to={`${base}/${id}/modifier`} className="bouton bouton--secondaire">
                Modifier
              </Link>
              <BoutonArchivage
                actif={produit.actif}
                nature="ce produit"
                onBasculer={async (actif) => {
                  await produitService.modifier(id, { actif });
                  setMessage(actif ? 'Produit réactivé.' : 'Produit archivé.');
                  requete.recharger();
                }}
              />
            </>
          )
        }
      />
      {message && <Alerte ton="succes">{message}</Alerte>}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du produit…">
        {(fiche) => (
          <>
            <FicheDonnees
              lignes={[
                ['Code', fiche.code],
                ['Nom', fiche.nom],
                ['Catégorie', libelleReference(categories, fiche.categorie_id, 'Nom de la catégorie indisponible')],
                ['Unité de stock', fiche.unite_stock],
                ['Usages', fiche.activites.map((code) => LIBELLES_ACTIVITES[code]).join(', ')],
                ['Suivi en stock', fiche.stockable ? 'Oui' : 'Non'],
                ['Prix de vente', fiche.prix_vente ? formaterMontant(fiche.prix_vente) : null],
                ['État', <PastilleStatut key="etat" libelle={fiche.actif ? 'Actif' : 'Archivé'} ton={fiche.actif ? 'succes' : 'neutre'} />],
                ['Modifié le', formaterDate(fiche.updated_at)],
              ]}
            />
            {fiche.stockable && possedePermission(profil, 'stock') && (
              <p className="section-fiche">
                <Link to={`/${activite}/stock?produit_id=${fiche._id}`}>Stock disponible</Link>
                {' · '}
                <Link to={`/${activite}/mouvements-stock?produit_id=${fiche._id}`}>Mouvements de stock</Link>
              </p>
            )}
          </>
        )}
      </BlocRequete>
    </section>
  );
}
