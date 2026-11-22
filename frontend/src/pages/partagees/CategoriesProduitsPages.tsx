import { ArrowRight } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { ReferentielCreation, ReferentielModification } from '../../components/referentiel/ReferentielEdition';
import { ReferentielFiche } from '../../components/referentiel/ReferentielFiche';
import { ReferentielListe } from '../../components/referentiel/ReferentielListe';
import { useActiviteCourante } from '../../hooks/useActiviteCourante';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { categorieProduitService } from '../../modules/categories-produits/services/categorieProduitService';

/** Base des pages de catégories dans l'espace ouvert (/:activite/categories-produits). */
function useBase() {
  return `/${useActiviteCourante()}/categories-produits`;
}

/** /:activite/categories-produits : liste des catégories, filtre actif. */
export function CategoriesProduitsPage() {
  const { profil } = useSession();
  return (
    <ReferentielListe
      titre="Catégories de produits"
      sousTitre="Regroupement des produits utilisé par les trois activités."
      base={useBase()}
      libelleNouveau="Nouvelle catégorie"
      peutCreer={possedePermission(profil, 'categories_produits', 'saisie')}
      basculerActif={(id, actif) => categorieProduitService.modifier(id, { actif })}
      lister={categorieProduitService.lister}
      creer={categorieProduitService.creer}
      proposerCode={categorieProduitService.proposerCode}
      aideCode="Par exemple CEREALES."
    />
  );
}

export function CategorieProduitNouveauPage() {
  return <ReferentielCreation titre="Nouvelle catégorie de produits" base={useBase()} aideCode="Par exemple CEREALES." creer={categorieProduitService.creer}
      proposerCode={categorieProduitService.proposerCode} />;
}

export function CategorieProduitModifierPage() {
  const { id = '' } = useParams();
  return (
    <ReferentielModification
      id={id}
      titre="Modifier la catégorie"
      base={useBase()}
      consulter={categorieProduitService.consulter}
      modifier={categorieProduitService.modifier}
    />
  );
}

/** Fiche d'une catégorie, avec accès aux produits qu'elle regroupe. */
export function CategorieProduitPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const activite = useActiviteCourante();
  return (
    <ReferentielFiche
      id={id}
      titreDefaut="Catégorie de produits"
      nature="cette catégorie"
      base={useBase()}
      libelleRetour="Retour aux catégories"
      peutSaisir={possedePermission(profil, 'categories_produits', 'saisie')}
      consulter={categorieProduitService.consulter}
      basculerActif={(identifiant, actif) => categorieProduitService.modifier(identifiant, { actif })}
      complement={(categorie) =>
        possedePermission(profil, 'produits') && (
          <p className="section-fiche">
            <Link to={`/${activite}/produits?categorie_id=${categorie._id}`} className="lien-avec-icone">Voir les produits de cette catégorie <ArrowRight size={16} aria-hidden="true" /></Link>
          </p>
        )
      }
    />
  );
}
