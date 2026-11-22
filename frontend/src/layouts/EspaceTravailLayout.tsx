import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Banknote,
  Boxes,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Contact,
  Ellipsis,
  Factory,
  History,
  House,
  LayoutDashboard,
  ListChecks,
  ListTree,
  LogOut,
  MapPin,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Sprout,
  Store,
  Tags,
  Tractor,
  Truck,
  Undo2,
  UserRound,
  Users,
  Wallet,
  Wheat,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';

import { Alerte } from '../components/Alerte';
import { useLibellesColonnes } from '../hooks/useLibellesColonnes';
import { useSession } from '../modules/authentification/hooks/useSession';
import type { Activite } from '../modules/profil/types/profilTypes';
import { espacesAutorises, filtrerSections, menuAdministration, type EntreeMenu, type SectionMenu } from '../navigation/menusNavigation';
import { confirmationEdition, consommerRetour, originesEdition, retourEdition } from '../utils/retourEdition';

const ICONES: Record<string, LucideIcon> = {
  'achats': ShoppingBasket,
  'campagnes-agricoles': CalendarDays,
  'categories-produits': Tags,
  'clients': Contact,
  'commandes-clients': ClipboardList,
  'cultures': Sprout,
  'depenses': Receipt,
  'encaissements': Wallet,
  'equipes-production': Users,
  'fournisseurs': Truck,
  'inventaires': ListChecks,
  'journal-operations': History,
  'materiels': Wrench,
  'mouvements-stock': ArrowLeftRight,
  'operations-agricoles': Tractor,
  'operations-transformation': Factory,
  'parametres-entreprise': Settings,
  'productions': Wheat,
  'produits': Boxes,
  'reglements-fournisseurs': Banknote,
  'retours-clients': Undo2,
  'roles': ShieldCheck,
  'sites-production': MapPin,
  'stock': Package,
  'tableau-de-bord': LayoutDashboard,
  'types-depenses': ListTree,
  'types-operations-agricoles': ListTree,
  'unites-transformation': Factory,
  'utilisateurs': UserRound,
  'ventes': ShoppingCart,
};

const ICONES_ACTIVITES: Record<Activite, LucideIcon> = {
  production: Sprout,
  transformation: Factory,
  commercialisation: Store,
};

/** Destinations de la barre inférieure mobile, par ordre de priorité. */
const PRINCIPAUX: Record<Activite, string[]> = {
  production: ['tableau-de-bord', 'operations-agricoles', 'productions'],
  transformation: ['tableau-de-bord', 'operations-transformation', 'stock'],
  commercialisation: ['tableau-de-bord', 'commandes-clients', 'ventes'],
};

const LIBELLES_ACTIVITES_COURTS: Record<Activite, string> = {
  production: 'Production',
  transformation: 'Transfo.',
  commercialisation: 'Commerce',
};

const LIBELLES_COURTS: Record<string, string> = {
  'tableau-de-bord': 'Accueil',
  'operations-agricoles': 'Travaux',
  'operations-transformation': 'Opérations',
  'commandes-clients': 'Commandes',
  'campagnes-agricoles': 'Campagnes',
  stock: 'Stock',
  'mouvements-stock': 'Mouvements',
  'reglements-fournisseurs': 'Règlements',
  'unites-transformation': 'Unités',
  roles: 'Rôles',
  'journal-operations': 'Journal',
  'parametres-entreprise': 'Paramètres',
};

function initiales(nom: string | undefined): string {
  return (nom ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase())
    .join('');
}

function LienNavigation({ entree, base, court = false }: { entree: EntreeMenu; base: string; court?: boolean }) {
  const Icone = court && entree.chemin === 'tableau-de-bord' ? House : ICONES[entree.chemin] ?? LayoutDashboard;
  const libelle = court ? LIBELLES_COURTS[entree.chemin] ?? entree.libelle : entree.libelle;

  return (
    <NavLink className="menu__lien" title={entree.libelle} aria-label={court ? entree.libelle : undefined} to={`${base}/${entree.chemin}`}>
      <Icone aria-hidden="true" size={18} strokeWidth={1.9} />
      <span>{libelle}</span>
    </NavLink>
  );
}

function SectionNavigation({ section, base }: { section: SectionMenu; base: string }) {
  return (
    <div className="navigation-section">
      <p className="navigation-section__titre">{section.titre}</p>
      {section.entrees.map((entree) => <LienNavigation key={entree.chemin} entree={entree} base={base} />)}
    </div>
  );
}

export function EspaceTravailLayout() {
  const { profil, deconnecter } = useSession();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const contenu = useRef<HTMLElement>(null);
  const panneau = useRef<HTMLDialogElement>(null);
  const compte = useRef<HTMLDetailsElement>(null);
  const titrePlus = useId();
  const [compact, definirCompact] = useState(() => localStorage.getItem('riz-sidebar-compact') === 'true');
  const [plus, setPlus] = useState(false);
  useLibellesColonnes(contenu);

  const espaces = espacesAutorises(profil);
  const espace = espaces.find(({ code }) => pathname.split('/')[1] === code);
  const administration = filtrerSections(profil, [menuAdministration]);
  const dansAdministration = pathname.startsWith('/administration');
  const sections = espace ? filtrerSections(profil, espace.sections) : dansAdministration ? administration : [];
  const base = espace ? `/${espace.code}` : '/administration';
  const entrees = sections.flatMap((section) => section.entrees);

  const priorites = espace ? PRINCIPAUX[espace.code] : [];
  const raccourcis = priorites
    .flatMap((chemin) => entrees.filter((entree) => entree.chemin === chemin))
    .concat(entrees.filter(({ chemin }) => !priorites.includes(chemin)))
    .slice(0, 3);

  const segment = pathname.split('/')[2];
  const sectionCourante = sections.find((section) => section.entrees.some(({ chemin }) => chemin === segment));
  const entreeCourante = sectionCourante?.entrees.find(({ chemin }) => chemin === segment);
  const libelleEspace = espace?.libelle ?? (dansAdministration ? 'Administration' : 'Espace de travail');

  useEffect(() => {
    const retour = retourEdition;
    if (retour && retour.url === pathname + search) {
      const zone = contenu.current;
      const restaurer = () => zone?.scrollTo(0, retour.position);
      restaurer();
      const observateur = new ResizeObserver(restaurer);
      if (zone?.firstElementChild) observateur.observe(zone.firstElementChild);
      const delai = window.setTimeout(() => {
        observateur.disconnect();
        consommerRetour();
      }, 2500);
      return () => {
        observateur.disconnect();
        window.clearTimeout(delai);
      };
    }
    contenu.current?.scrollTo(0, 0);
    panneau.current?.close();
    setPlus(false);
  }, [pathname]);

  useEffect(() => {
    const ordinateur = window.matchMedia('(min-width: 861px)');
    function fermerSurOrdinateur() {
      if (ordinateur.matches) panneau.current?.close();
    }
    ordinateur.addEventListener('change', fermerSurOrdinateur);
    return () => ordinateur.removeEventListener('change', fermerSurOrdinateur);
  }, []);

  useEffect(() => {
    function fermerCompte(evenement: MouseEvent) {
      if (compte.current?.open && !compte.current.contains(evenement.target as Node)) compte.current.open = false;
    }
    document.addEventListener('click', fermerCompte);
    return () => document.removeEventListener('click', fermerCompte);
  }, []);

  async function seDeconnecter() {
    await deconnecter();
    navigate('/connexion', { replace: true });
  }

  function basculerMenu() {
    localStorage.setItem('riz-sidebar-compact', String(!compact));
    definirCompact(!compact);
  }

  function selecteurActivites(variante: 'laterale' | 'panneau') {
    if (espaces.length < 2 && variante === 'laterale') return null;
    if (espaces.length === 0) return null;

    return (
      <nav className={`selecteur-activite selecteur-activite--${variante}`} aria-label="Changer d’activité">
        {espaces.map(({ code, libelle }) => {
          const Icone = ICONES_ACTIVITES[code];
          const actif = espace?.code === code;
          return (
            <Link key={code} to={`/${code}`} className="selecteur-activite__option" aria-current={actif ? 'true' : undefined} title={libelle}>
              <Icone size={17} aria-hidden="true" />
              <span>{variante === 'laterale' ? LIBELLES_ACTIVITES_COURTS[code] : libelle}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  const marque = (
    <Link to="/" className="marque-travail">
      <span className="marque-travail__symbole" aria-hidden="true">
        <Wheat size={20} strokeWidth={2.2} />
      </span>
      <span className="marque-travail__texte">
        <strong>Riz de Niono</strong>
        <small>Gestion de la filière riz</small>
      </span>
    </Link>
  );

  const menuCompte = (
    <details ref={compte} key={pathname} className="barre__compte">
      <summary aria-label="Options du compte">
        <span className="avatar" aria-hidden="true">{initiales(profil?.nom)}</span>
        <span className="barre__compte-identite">
          <strong>{profil?.nom}</strong>
          <small>{profil?.role?.nom ?? 'Compte'}</small>
        </span>
        <ChevronDown className="compte-chevron" size={15} aria-hidden="true" />
      </summary>
      <nav className="barre__options" aria-label="Options du compte">
        <div className="barre__options-entete">
          <strong>{profil?.nom}</strong>
          <small>{profil?.email}</small>
        </div>
        <Link to="/profil" className="menu__lien"><UserRound size={17} aria-hidden="true" /> Mon profil</Link>
        {administration.length > 0 && (
          <Link to="/administration" className="menu__lien"><ShieldCheck size={17} aria-hidden="true" /> Administration</Link>
        )}
        <button type="button" className="menu__lien" onClick={seDeconnecter}><LogOut size={17} aria-hidden="true" /> Se déconnecter</button>
      </nav>
    </details>
  );

  return (
    <div
      className={`espace espace-travail${compact ? ' espace-travail--compact' : ''}`}
      onClickCapture={(event) => {
        const lien = (event.target as HTMLElement).closest('a');
        if (!lien) return;
        const cible = new URL(lien.href);
        if (/\/(nouveau|modifier)$/.test(cible.pathname)) {
          originesEdition.set(cible.pathname, { url: pathname + search, position: contenu.current?.scrollTop ?? 0 });
        }
      }}
    >
      <a href="#contenu" className="lien-evitement">Aller au contenu</a>

      <aside className="navigation-laterale">
        <div className="navigation-laterale__entete">
          {marque}
          <button
            type="button"
            className="navigation-laterale__basculer bouton-icone"
            title={compact ? 'Déployer le menu' : 'Réduire le menu'}
            aria-label={compact ? 'Déployer le menu' : 'Réduire le menu'}
            aria-expanded={!compact}
            onClick={basculerMenu}
          >
            {compact ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          </button>
        </div>
        {selecteurActivites('laterale')}
        <nav className="navigation-laterale__liens" aria-label={`Navigation : ${libelleEspace}`}>
          {sections.map((section) => <SectionNavigation key={section.titre} section={section} base={base} />)}
        </nav>
        {!dansAdministration && administration.length > 0 && (
          <div className="navigation-laterale__pied">
            <Link to="/administration" className="menu__lien" title="Administration">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>Administration</span>
            </Link>
          </div>
        )}
      </aside>

      <header className="entete-travail">
        <div className="entete-travail__marque">{marque}</div>
        <nav className="fil-ariane" aria-label="Fil d’Ariane">
          <span>{libelleEspace}</span>
          {sectionCourante && sectionCourante.titre !== 'Pilotage' && sectionCourante.titre !== libelleEspace && (
            <>
              <ChevronRight size={14} aria-hidden="true" />
              <span>{sectionCourante.titre}</span>
            </>
          )}
          {entreeCourante && (
            <>
              <ChevronRight size={14} aria-hidden="true" />
              <Link to={`${base}/${entreeCourante.chemin}`} title={entreeCourante.libelle} aria-current={pathname === `${base}/${entreeCourante.chemin}` ? 'page' : undefined}>
                {entreeCourante.libelle}
              </Link>
            </>
          )}
        </nav>
        {menuCompte}
      </header>

      <main id="contenu" ref={contenu} className="contenu contenu-travail" tabIndex={-1}>
        <div key={pathname} className="contenu-travail__page">
          {confirmationEdition?.origine === pathname + search && (
            <Alerte ton="succes">
              {confirmationEdition.message}
              {confirmationEdition.fiche && <Link to={confirmationEdition.fiche}> Voir la fiche</Link>}
            </Alerte>
          )}
          <Outlet />
        </div>
      </main>

      <nav className="navigation-mobile" aria-label="Navigation principale">
        {raccourcis.map((entree) => <LienNavigation key={entree.chemin} entree={entree} base={base} court />)}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={plus}
          onClick={() => {
            panneau.current?.showModal();
            setPlus(true);
          }}
        >
          <Ellipsis size={22} aria-hidden="true" />
          <span>Plus</span>
        </button>
      </nav>

      <dialog ref={panneau} className="panneau-plus" aria-labelledby={titrePlus} onClose={() => setPlus(false)}>
        <div className="panneau-plus__entete">
          <h2 id={titrePlus}>{libelleEspace}</h2>
          <button type="button" aria-label="Fermer" className="bouton-icone" onClick={() => panneau.current?.close()}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {selecteurActivites('panneau')}
        <nav className="panneau-plus__liens" aria-label="Autres destinations">
          {sections.map((section) => {
            const liens = section.entrees.filter((entree) => !raccourcis.includes(entree));
            if (!liens.length) return null;
            return <SectionNavigation key={section.titre} section={{ ...section, entrees: liens }} base={base} />;
          })}
          {!dansAdministration && administration.length > 0 && (
            <div className="navigation-section">
              <p className="navigation-section__titre">Compte</p>
              <Link to="/administration" className="menu__lien"><ShieldCheck size={18} aria-hidden="true" /> <span>Administration</span></Link>
            </div>
          )}
        </nav>
      </dialog>
    </div>
  );
}
