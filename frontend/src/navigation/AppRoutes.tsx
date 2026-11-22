import { ModaleEdition } from '../components/ModaleEdition';
import type { ComponentType } from 'react';
import { createBrowserRouter, Outlet, RouterProvider, type RouteObject } from 'react-router';

import { EspaceTravailLayout } from '../layouts/EspaceTravailLayout';
import { PublicLayout } from '../layouts/PublicLayout';
import { FournisseurSession } from '../modules/authentification/components/FournisseurSession';
import { ConnexionPage } from '../pages/authentification/ConnexionPage';
import { MotDePasseOubliePage } from '../pages/authentification/MotDePasseOubliePage';
import { ReinitialiserMotDePassePage } from '../pages/authentification/ReinitialiserMotDePassePage';
import { ClientModifierPage, ClientNouveauPage, ClientPage, ClientsPage } from '../pages/partagees/ClientsPages';
import { CommandeClientPage } from '../pages/commercialisation/CommandeClientPage';
import { CommandeClientModifierPage, CommandeClientNouveauPage, CommandesClientsPage } from '../pages/commercialisation/CommandesClientsPages';
import { EncaissementModifierPage, EncaissementNouveauPage, EncaissementPage, EncaissementsPage } from '../pages/partagees/EncaissementsPages';
import { RetourClientModifierPage, RetourClientNouveauPage, RetourClientPage, RetoursClientsPage } from '../pages/partagees/RetoursClientsPages';
import { VentePage } from '../pages/partagees/VentePage';
import { VenteModifierPage, VenteNouveauPage, VentesPage } from '../pages/partagees/VentesPages';
import { TableauDeBordCommercialisationPage } from '../pages/commercialisation/TableauDeBordCommercialisationPage';
import { JournalOperationPage, JournalOperationsPage } from '../pages/administration/JournalOperationsPages';
import { ParametresEntrepriseModifierPage, ParametresEntreprisePage } from '../pages/administration/ParametresEntreprisePages';
import { RoleModifierPage, RoleNouveauPage, RolePage, RolesPage } from '../pages/administration/RolesPages';
import { UtilisateurModifierPage, UtilisateurNouveauPage, UtilisateurPage, UtilisateursPage } from '../pages/administration/UtilisateursPages';
import { AchatPage } from '../pages/partagees/AchatPage';
import { AchatModifierPage, AchatNouveauPage, AchatsPage } from '../pages/partagees/AchatsPages';
import { FournisseurModifierPage, FournisseurNouveauPage, FournisseurPage, FournisseursPage } from '../pages/partagees/FournisseursPages';
import { ReglementFournisseurPage } from '../pages/partagees/ReglementFournisseurPage';
import {
  ReglementFournisseurModifierPage,
  ReglementFournisseurNouveauPage,
  ReglementsFournisseursPage,
} from '../pages/partagees/ReglementsFournisseursPages';
import {
  CategorieProduitModifierPage,
  CategorieProduitNouveauPage,
  CategorieProduitPage,
  CategoriesProduitsPage,
} from '../pages/partagees/CategoriesProduitsPages';
import { ProduitModifierPage, ProduitNouveauPage } from '../pages/partagees/ProduitEditionPages';
import { ProduitPage } from '../pages/partagees/ProduitPage';
import { ProduitsPage } from '../pages/partagees/ProduitsPage';
import { CultureModifierPage, CultureNouveauPage, CulturePage, CulturesPage } from '../pages/production/CulturesPages';
import {
  EquipeProductionModifierPage,
  EquipeProductionNouveauPage,
  EquipeProductionPage,
  EquipesProductionPage,
} from '../pages/production/EquipesProductionPages';
import { OperationAgricoleModifierPage, OperationAgricoleNouveauPage } from '../pages/production/OperationAgricoleEditionPages';
import { OperationAgricolePage } from '../pages/production/OperationAgricolePage';
import { OperationsAgricolesPage } from '../pages/production/OperationsAgricolesPage';
import {
  TypeOperationAgricoleModifierPage,
  TypeOperationAgricoleNouveauPage,
  TypeOperationAgricolePage,
  TypesOperationsAgricolesPage,
} from '../pages/production/TypesOperationsAgricolesPages';
import { DepenseModifierPage, DepenseNouveauPage, DepensePage, DepensesPage } from '../pages/partagees/DepensesPages';
import { InventaireModifierPage, InventaireNouveauPage, InventairePage, InventairesPage } from '../pages/partagees/InventairesPages';
import { MaterielModifierPage, MaterielNouveauPage, MaterielPage, MaterielsPage } from '../pages/partagees/MaterielsPages';
import { TypeDepenseModifierPage, TypeDepenseNouveauPage, TypeDepensePage, TypesDepensesPage } from '../pages/partagees/TypesDepensesPages';
import { MouvementsStockPage } from '../pages/partagees/MouvementsStockPage';
import { MouvementStockPage } from '../pages/partagees/MouvementStockPage';
import { StockPage } from '../pages/partagees/StockPage';
import { CampagneAgricoleModifierPage } from '../pages/production/CampagneAgricoleModifierPage';
import { CampagneAgricoleNouveauPage } from '../pages/production/CampagneAgricoleNouveauPage';
import { CampagneAgricolePage } from '../pages/production/CampagneAgricolePage';
import { CampagnesAgricolesPage } from '../pages/production/CampagnesAgricolesPage';
import { ProductionModifierPage } from '../pages/production/ProductionModifierPage';
import { ProductionNouveauPage } from '../pages/production/ProductionNouveauPage';
import { ProductionPage } from '../pages/production/ProductionPage';
import { ProductionsPage } from '../pages/production/ProductionsPage';
import { SiteProductionModifierPage } from '../pages/production/SiteProductionModifierPage';
import { SiteProductionNouveauPage } from '../pages/production/SiteProductionNouveauPage';
import { SiteProductionPage } from '../pages/production/SiteProductionPage';
import { SitesProductionPage } from '../pages/production/SitesProductionPage';
import { TableauDeBordProductionPage } from '../pages/production/TableauDeBordProductionPage';
import { ProfilModifierPage } from '../pages/profil/ProfilModifierPage';
import { ProfilMotDePassePage } from '../pages/profil/ProfilMotDePassePage';
import { ProfilPage } from '../pages/profil/ProfilPage';
import { AccesRefusePage } from '../pages/systeme/AccesRefusePage';
import { AccueilEspacePage } from '../pages/systeme/AccueilEspacePage';
import { AccueilRedirectionPage } from '../pages/systeme/AccueilRedirectionPage';
import { PageEnPreparationPage } from '../pages/systeme/PageEnPreparationPage';
import { PageIntrouvablePage } from '../pages/systeme/PageIntrouvablePage';
import { OperationTransformationPage } from '../pages/transformation/OperationTransformationPage';
import {
  OperationsTransformationPage,
  OperationTransformationModifierPage,
  OperationTransformationNouveauPage,
} from '../pages/transformation/OperationsTransformationPages';
import {
  UniteTransformationModifierPage,
  UniteTransformationNouveauPage,
  UniteTransformationPage,
  UnitesTransformationPage,
} from '../pages/transformation/UnitesTransformationPages';
import { TableauDeBordTransformationPage } from '../pages/transformation/TableauDeBordTransformationPage';
import { CHEMIN_TABLEAU_DE_BORD, espacesActivites, menuAdministration, type EntreeMenu } from './menusNavigation';
import { RouteAutorisee } from './RouteAutorisee';
import { RouteConnectee } from './RouteConnectee';
import { RoutePublique } from './RoutePublique';
import type { Activite, CodeAction } from '../modules/profil/types/profilTypes';

/** Pages livrées d'un module : liste (L), création (N), fiche (D) et modification (M), document 05. */
interface PagesModule {
  liste: ComponentType;
  nouveau?: ComponentType;
  fiche?: ComponentType;
  modifier?: ComponentType;
  /** Modification d'une ressource unique, sans identifiant (B/modifier) : paramètres de l'entreprise. */
  edition?: ComponentType;
  /** Action exigée par la création et la modification : saisie par défaut, administration pour les modules d'accès. */
  actionEcriture?: CodeAction;
}

/** Pages propres à un espace, par chemin complet. */
const PAGES_ESPACES: Record<string, PagesModule> = {
  '/administration/utilisateurs': {
    liste: UtilisateursPage,
    nouveau: UtilisateurNouveauPage,
    fiche: UtilisateurPage,
    modifier: UtilisateurModifierPage,
    actionEcriture: 'administration',
  },
  '/administration/roles': { liste: RolesPage, nouveau: RoleNouveauPage, fiche: RolePage, modifier: RoleModifierPage, actionEcriture: 'administration' },
  '/administration/journal-operations': { liste: JournalOperationsPage, fiche: JournalOperationPage },
  '/administration/parametres-entreprise': { liste: ParametresEntreprisePage, edition: ParametresEntrepriseModifierPage, actionEcriture: 'administration' },
  [`/production/${CHEMIN_TABLEAU_DE_BORD}`]: { liste: TableauDeBordProductionPage },
  [`/transformation/${CHEMIN_TABLEAU_DE_BORD}`]: { liste: TableauDeBordTransformationPage },
  [`/commercialisation/${CHEMIN_TABLEAU_DE_BORD}`]: { liste: TableauDeBordCommercialisationPage },
  '/commercialisation/commandes-clients': {
    liste: CommandesClientsPage,
    nouveau: CommandeClientNouveauPage,
    fiche: CommandeClientPage,
    modifier: CommandeClientModifierPage,
  },
  '/transformation/unites-transformation': {
    liste: UnitesTransformationPage,
    nouveau: UniteTransformationNouveauPage,
    fiche: UniteTransformationPage,
    modifier: UniteTransformationModifierPage,
  },
  '/transformation/operations-transformation': {
    liste: OperationsTransformationPage,
    nouveau: OperationTransformationNouveauPage,
    fiche: OperationTransformationPage,
    modifier: OperationTransformationModifierPage,
  },
  '/production/sites-production': {
    liste: SitesProductionPage,
    nouveau: SiteProductionNouveauPage,
    fiche: SiteProductionPage,
    modifier: SiteProductionModifierPage,
  },
  '/production/campagnes-agricoles': {
    liste: CampagnesAgricolesPage,
    nouveau: CampagneAgricoleNouveauPage,
    fiche: CampagneAgricolePage,
    modifier: CampagneAgricoleModifierPage,
  },
  '/production/types-operations-agricoles': {
    liste: TypesOperationsAgricolesPage,
    nouveau: TypeOperationAgricoleNouveauPage,
    fiche: TypeOperationAgricolePage,
    modifier: TypeOperationAgricoleModifierPage,
  },
  '/production/equipes-production': {
    liste: EquipesProductionPage,
    nouveau: EquipeProductionNouveauPage,
    fiche: EquipeProductionPage,
    modifier: EquipeProductionModifierPage,
  },
  '/production/cultures': { liste: CulturesPage, nouveau: CultureNouveauPage, fiche: CulturePage, modifier: CultureModifierPage },
  '/production/operations-agricoles': {
    liste: OperationsAgricolesPage,
    nouveau: OperationAgricoleNouveauPage,
    fiche: OperationAgricolePage,
    modifier: OperationAgricoleModifierPage,
  },
  '/production/productions': {
    liste: ProductionsPage,
    nouveau: ProductionNouveauPage,
    fiche: ProductionPage,
    modifier: ProductionModifierPage,
  },
};

/** Pages partagées (pages/partagees), servies sous /:activite/… dans chaque espace dont le menu les contient. */
const PAGES_PARTAGEES: Record<string, PagesModule> = {
  produits: { liste: ProduitsPage, nouveau: ProduitNouveauPage, fiche: ProduitPage, modifier: ProduitModifierPage },
  'categories-produits': {
    liste: CategoriesProduitsPage,
    nouveau: CategorieProduitNouveauPage,
    fiche: CategorieProduitPage,
    modifier: CategorieProduitModifierPage,
  },
  fournisseurs: { liste: FournisseursPage, nouveau: FournisseurNouveauPage, fiche: FournisseurPage, modifier: FournisseurModifierPage },
  achats: { liste: AchatsPage, nouveau: AchatNouveauPage, fiche: AchatPage, modifier: AchatModifierPage },
  'reglements-fournisseurs': {
    liste: ReglementsFournisseursPage,
    nouveau: ReglementFournisseurNouveauPage,
    fiche: ReglementFournisseurPage,
    modifier: ReglementFournisseurModifierPage,
  },
  ventes: { liste: VentesPage, nouveau: VenteNouveauPage, fiche: VentePage, modifier: VenteModifierPage },
  clients: { liste: ClientsPage, nouveau: ClientNouveauPage, fiche: ClientPage, modifier: ClientModifierPage },
  encaissements: { liste: EncaissementsPage, nouveau: EncaissementNouveauPage, fiche: EncaissementPage, modifier: EncaissementModifierPage },
  'retours-clients': { liste: RetoursClientsPage, nouveau: RetourClientNouveauPage, fiche: RetourClientPage, modifier: RetourClientModifierPage },
  inventaires: { liste: InventairesPage, nouveau: InventaireNouveauPage, fiche: InventairePage, modifier: InventaireModifierPage },
  materiels: { liste: MaterielsPage, nouveau: MaterielNouveauPage, fiche: MaterielPage, modifier: MaterielModifierPage },
  'types-depenses': { liste: TypesDepensesPage, nouveau: TypeDepenseNouveauPage, fiche: TypeDepensePage, modifier: TypeDepenseModifierPage },
  depenses: { liste: DepensesPage, nouveau: DepenseNouveauPage, fiche: DepensePage, modifier: DepenseModifierPage },
  stock: { liste: StockPage },
  'mouvements-stock': { liste: MouvementsStockPage, fiche: MouvementStockPage },
};

/**
 * Routes protégées d'une entrée de menu. Module livré : liste, nouveau et modifier (action saisie exigée),
 * fiche ; les autres sous-chemins mènent à la page introuvable. Module non livré : « en préparation ».
 */
function routesEntree(prefixe: string, entree: EntreeMenu, activite?: Activite): RouteObject[] {
  const chemin = `${prefixe}/${entree.chemin}`;
  const pages = PAGES_ESPACES[chemin] ?? PAGES_PARTAGEES[entree.chemin];
  const garde = (Page: ComponentType, action?: CodeAction, edition = false) => (
    <RouteAutorisee activite={activite} module={entree.module} action={action}>
      {edition ? <ModaleEdition base={chemin}><Page /></ModaleEdition> : <Page />}
    </RouteAutorisee>
  );
  if (!pages) {
    const element = (
      <RouteAutorisee activite={activite} module={entree.module}>
        <PageEnPreparationPage titre={entree.libelle} />
      </RouteAutorisee>
    );
    return [
      { path: chemin, element },
      { path: `${chemin}/*`, element },
    ];
  }
  const ecriture = pages.actionEcriture ?? 'saisie';
  const routes: RouteObject[] = [{ path: chemin, element: garde(pages.liste) }];
  if (pages.nouveau) routes.push({ path: `${chemin}/nouveau`, element: garde(pages.nouveau, ecriture, true) });
  if (pages.edition) routes.push({ path: `${chemin}/modifier`, element: garde(pages.edition, ecriture, true) });
  if (pages.fiche) routes.push({ path: `${chemin}/:id`, element: garde(pages.fiche) });
  if (pages.modifier) routes.push({ path: `${chemin}/:id/modifier`, element: garde(pages.modifier, ecriture, true) });
  return routes;
}

const routesEspaces: RouteObject[] = espacesActivites.flatMap((espace) => [
  { path: `/${espace.code}`, element: <AccueilEspacePage espace={espace.code} /> },
  ...espace.sections.flatMap((section) => section.entrees.flatMap((entree) => routesEntree(`/${espace.code}`, entree, espace.code))),
]);

const routesAdministration: RouteObject[] = [
  { path: '/administration', element: <AccueilEspacePage espace="administration" /> },
  ...menuAdministration.entrees.flatMap((entree) => routesEntree('/administration', entree)),
];

/** Racine : la session enveloppe toutes les routes (elle a besoin du routeur pour rediriger). */
function RacineApplication() {
  return (
    <FournisseurSession>
      <Outlet />
    </FournisseurSession>
  );
}

/**
 * Routes de navigation (document 05). Les segments composés utilisent des tirets.
 * Espace public : connexion et réinitialisation. Espace connecté : profil, espaces métier, administration.
 */
const routeur = createBrowserRouter([
  {
    element: <RacineApplication />,
    children: [
      {
        element: <RoutePublique />,
        children: [
          {
            element: <PublicLayout />,
            children: [
              { path: '/connexion', element: <ConnexionPage /> },
              { path: '/mot-de-passe-oublie', element: <MotDePasseOubliePage /> },
            ],
          },
        ],
      },
      // Accessible connecté ou non : le lien reçu par e-mail ouvre toujours ce formulaire.
      { element: <PublicLayout />, children: [{ path: '/reinitialiser-mot-de-passe', element: <ReinitialiserMotDePassePage /> }] },
      {
        element: <RouteConnectee />,
        children: [
          {
            element: <EspaceTravailLayout />,
            children: [
              { path: '/', element: <AccueilRedirectionPage /> },
              { path: '/403', element: <AccesRefusePage /> },
              { path: '/profil', element: <ProfilPage /> },
              { path: '/profil/modifier', element: <ProfilModifierPage /> },
              { path: '/profil/mot-de-passe', element: <ProfilMotDePassePage /> },
              ...routesEspaces,
              ...routesAdministration,
              { path: '*', element: <PageIntrouvablePage /> },
            ],
          },
        ],
      },
    ],
  },
]);

export function AppRoutes() {
  return <RouterProvider router={routeur} />;
}
