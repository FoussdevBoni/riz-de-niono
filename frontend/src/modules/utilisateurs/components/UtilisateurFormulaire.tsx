import { useChampBrouillon } from '../../../hooks/useChampBrouillon';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { Alerte } from '../../../components/Alerte';
import { ChampCases } from '../../../components/ChampCases';
import { ChampFormulaire } from '../../../components/ChampFormulaire';
import { ChampSelection } from '../../../components/ChampSelection';
import { useEnvoiFormulaire } from '../../../hooks/useEnvoiFormulaire';
import type { SiteProduction } from '../../production/sites-production/types/siteProductionTypes';
import { ACTIVITES, LIBELLES_ACTIVITES } from '../../produits/utils/libellesProduits';
import type { Activite, Profil } from '../../profil/types/profilTypes';
import type { Role } from '../../roles/types/roleTypes';
import type { DonneesUtilisateur, UtilisateurResume } from '../types/utilisateurTypes';

const CHAMPS = ['nom', 'email', 'mot_de_passe', 'role_id', 'activites', 'site_ids', 'actif'] as const;

/**
 * Formulaire d'un utilisateur. Le gestionnaire n'attribue que les activités et sites de son propre périmètre
 * (403 sinon) ; « tous les sites » n'est proposé qu'à un gestionnaire sans restriction de site. Sur son propre
 * compte, rôle, périmètre et activation sont figés (409 modification_propre_compte).
 */
export function UtilisateurFormulaire({
  utilisateur,
  profil,
  roles,
  sites,
  retour,
  onEnregistrer,
}: {
  utilisateur?: UtilisateurResume;
  profil: Profil | null;
  roles: Role[];
  sites: SiteProduction[];
  retour: string;
  onEnregistrer: (donnees: DonneesUtilisateur) => Promise<void>;
}) {
  const proprecompte = utilisateur?._id === profil?._id;
  const gestionnaireLimite = (profil?.site_ids.length ?? 0) > 0;
  const [nom, setNom] = useChampBrouillon('nom', utilisateur?.nom ?? '');
  const [email, setEmail] = useChampBrouillon('email', utilisateur?.email ?? '');
  const [motDePasse, setMotDePasse] = useState('');
  const [roleId, setRoleId] = useChampBrouillon('roleId', utilisateur?.role_id ?? '');
  const [activites, setActivites] = useChampBrouillon<string[]>('activites', utilisateur?.activites ?? []);
  const [tousSites, setTousSites] = useChampBrouillon('tousSites', utilisateur ? utilisateur.site_ids.length === 0 && !gestionnaireLimite : !gestionnaireLimite);
  const [siteIds, setSiteIds] = useChampBrouillon<string[]>('siteIds', utilisateur?.site_ids ?? []);
  const { envoi, executer, erreurChamp, erreurGenerale } = useEnvoiFormulaire();

  const activitesProfil = profil?.activites ?? [];
  const optionsRoles = roles.filter((role) => role.actif || role._id === roleId).map((role) => ({ valeur: role._id, libelle: role.nom }));
  const optionsActivites = ACTIVITES.filter((activite) => activitesProfil.includes(activite) || activites.includes(activite)).map((activite) => ({
    valeur: activite,
    libelle: LIBELLES_ACTIVITES[activite],
  }));
  const activitesVerrouillees = proprecompte ? activites : ACTIVITES.filter((activite) => !activitesProfil.includes(activite) && activites.includes(activite));
  const sitesProposes = sites.filter((site) => (site.actif || siteIds.includes(site._id)) && (!gestionnaireLimite || profil!.site_ids.includes(site._id)));
  const optionsSites = sitesProposes.map((site) => ({ valeur: site._id, libelle: site.actif ? site.nom : `${site.nom} (archivé)` }));

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    const donnees: DonneesUtilisateur = { nom: nom.trim(), email: email.trim().toLowerCase() };
    if (motDePasse) donnees.mot_de_passe = motDePasse;
    if (!proprecompte) {
      donnees.role_id = roleId;
      donnees.activites = activites as Activite[];
      donnees.site_ids = tousSites ? [] : siteIds;
    }
    void executer(() => onEnregistrer(donnees));
  }

  const generale = erreurGenerale(CHAMPS);
  const complet = Boolean(nom.trim() && email.trim() && roleId && activites.length > 0 && (utilisateur || motDePasse.length >= 8) && (tousSites || siteIds.length > 0));
  return (
    <form className="formulaire formulaire--carte" onSubmit={soumettre} noValidate>
      {generale && <Alerte ton="erreur">{generale}</Alerte>}
      {proprecompte && <Alerte ton="information">Votre propre compte : le rôle, le périmètre et l’activation se modifient par un autre gestionnaire.</Alerte>}
      <div className="grille-champs">
        <ChampFormulaire libelle="Nom" required maxLength={100} value={nom} onChange={(evenement) => setNom(evenement.target.value)} erreur={erreurChamp('nom')} />
        <ChampFormulaire
          libelle="Adresse électronique"
          type="email"
          required
          autoComplete="off"
          value={email}
          onChange={(evenement) => setEmail(evenement.target.value)}
          erreur={erreurChamp('email')}
        />
      </div>
      <div className="grille-champs">
        <ChampFormulaire
          libelle={utilisateur ? 'Nouveau mot de passe' : 'Mot de passe initial'}
          type="password"
          autoComplete="new-password"
          required={!utilisateur}
          minLength={8}
          maxLength={128}
          value={motDePasse}
          onChange={(evenement) => setMotDePasse(evenement.target.value)}
          erreur={erreurChamp('mot_de_passe')}
          aide={utilisateur ? 'Facultatif : le redéfinir révoque toutes les sessions de l’utilisateur.' : '8 caractères au moins.'}
        />
        <ChampSelection
          libelle="Rôle"
          required
          disabled={proprecompte}
          options={optionsRoles}
          value={roleId}
          onChange={(evenement) => setRoleId(evenement.target.value)}
          erreur={erreurChamp('role_id')}
          aide={roles.length === 0 ? 'La liste des rôles n’est pas accessible avec vos droits.' : undefined}
        />
      </div>
      <ChampCases
        libelle="Activités"
        options={optionsActivites}
        valeurs={activites}
        verrouillees={activitesVerrouillees}
        onChange={setActivites}
        erreur={erreurChamp('activites')}
        aide="Seules les activités de votre propre périmètre peuvent être attribuées."
      />
      <fieldset className="champ champ-cases">
        <legend className="champ__libelle">Sites autorisés</legend>
        <label className="champ-cases__option">
          <input type="checkbox" checked={tousSites} disabled={proprecompte || gestionnaireLimite} onChange={(evenement) => setTousSites(evenement.target.checked)} />
          <span>Tous les sites</span>
          {gestionnaireLimite && <span className="texte-doux">· réservé à un gestionnaire sans restriction de site</span>}
        </label>
        {!tousSites && (
          <ChampCases
            libelle="Sites"
            options={optionsSites}
            valeurs={siteIds}
            verrouillees={proprecompte ? siteIds : []}
            onChange={setSiteIds}
            erreur={erreurChamp('site_ids')}
            aide={sites.length === 0 ? 'La liste des sites n’est pas accessible avec vos droits.' : 'Cocher au moins un site, ou « Tous les sites ».'}
          />
        )}
      </fieldset>
      <div className="formulaire__actions">
        <Link to={retour} className="bouton bouton--secondaire">
          Annuler
        </Link>
        <button type="submit" className="bouton" disabled={envoi || !complet}>
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
