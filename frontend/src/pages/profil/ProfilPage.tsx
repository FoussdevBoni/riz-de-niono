import { Link } from 'react-router';

import { EnTetePage } from '../../components/EnTetePage';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { espacesActivites } from '../../navigation/menusNavigation';

/** /profil : informations de l'utilisateur connecté, rôle, activités et droits. */
export function ProfilPage() {
  const { profil } = useSession();
  if (!profil) return null;
  const activites = espacesActivites.filter((espace) => profil.activites.includes(espace.code)).map((espace) => espace.libelle);
  const modules = new Set(profil.permissions.map((permission) => permission.module));

  return (
    <section className="page-etroite">
      <EnTetePage
        titre="Mon profil"
        actions={
          <>
            <Link to="/profil/modifier" className="bouton bouton--secondaire">
              Modifier mon nom
            </Link>
            <Link to="/profil/mot-de-passe" className="bouton">
              Changer mon mot de passe
            </Link>
          </>
        }
      />
      <dl className="fiche">
        <div className="fiche__ligne">
          <dt>Nom</dt>
          <dd>{profil.nom}</dd>
        </div>
        <div className="fiche__ligne">
          <dt>Adresse électronique</dt>
          <dd>{profil.email}</dd>
        </div>
        <div className="fiche__ligne">
          <dt>Rôle</dt>
          <dd>{profil.role?.nom ?? '—'}</dd>
        </div>
        <div className="fiche__ligne">
          <dt>Activités</dt>
          <dd>
            {activites.length > 0 ? activites.map((libelle) => <span key={libelle} className="pastille">{libelle}</span>) : '—'}
          </dd>
        </div>
        <div className="fiche__ligne">
          <dt>Sites</dt>
          <dd>{profil.site_ids.length === 0 ? 'Tous les sites' : `${profil.site_ids.length} site(s) autorisé(s)`}</dd>
        </div>
        <div className="fiche__ligne">
          <dt>Droits</dt>
          <dd>
            {profil.permissions.length} permission(s) sur {modules.size} module(s)
          </dd>
        </div>
      </dl>
    </section>
  );
}
