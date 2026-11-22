import { Types } from 'mongoose';

import { decimal } from '../../../../database/decimalMongo.js';
import { intervalleDates } from '../../../../http/validation/validationRequete.js';
import { totaliserDepensesValidees } from '../../../depenses/services/depenseService.js';
import { produitService } from '../../../produits/services/produitService.js';
import { agregerVentesValidees, lireIdsVentes, type SituationVente } from '../../../ventes/services/venteService.js';
import { agregerCommandesLivrees } from '../../commandes-clients/services/commandeClientService.js';
import { totaliserEncaissementsValides } from '../../encaissements/services/encaissementService.js';

export interface TableauDeBordCommercialisation {
  filtres: { date_debut: Date | null; date_fin: Date | null; client_id: string | null; produit_id: string | null };
  /** Ventes validées de la commercialisation sur la période (date_vente). */
  ventes_validees: { nombre: number; montant_total: string };
  /** Par produit, au prix appliqué ; produit_id limite cette liste. */
  quantites_vendues: { produit_id: string; unite_stock: string | null; quantite: string; quantite_retournee: string; montant: string }[];
  /** Commandes livrées sur la période (date de livraison). */
  commandes_livrees: { nombre: number; montant_total: string };
  /** Encaissements validés sur la période (date_paiement). */
  encaissements: string;
  /** Situation des ventes validées de la période : encaissé, retours, solde et trop-perçu. */
  soldes: SituationVente;
  depenses_enregistrees: string;
}

/**
 * Service du tableau de bord commercial : ventes validées, commandes livrées, encaissements validés,
 * soldes et dépenses commerciales validées, lus via leurs services pour la période et le client.
 */
export const tableauDeBordCommercialisationService = {
  async consulter(filtres: {
    date_debut?: Date;
    date_fin?: Date;
    client_id?: string;
    produit_id?: string;
  }): Promise<TableauDeBordCommercialisation> {
    const periode = intervalleDates(filtres.date_debut, filtres.date_fin);
    const client = filtres.client_id ? new Types.ObjectId(filtres.client_id) : undefined;
    const filtreVentes: Record<string, unknown> = { activite: 'commercialisation' };
    const filtreCommandes: Record<string, unknown> = {};
    const filtreEncaissements: Record<string, unknown> = { activite: 'commercialisation' };
    const filtreDepenses: Record<string, unknown> = { activite: 'commercialisation' };
    if (client) {
      filtreVentes.client_id = filtreCommandes.client_id = client;
      filtreEncaissements.vente_id = { $in: await lireIdsVentes({ activite: 'commercialisation', client_id: client }) };
    }
    if (periode) {
      filtreVentes.date_vente = periode;
      filtreCommandes.livree_at = periode;
      filtreEncaissements.date_paiement = periode;
      filtreDepenses.date_depense = periode;
    }

    const [ventes, commandes, encaissements, depenses] = await Promise.all([
      agregerVentesValidees(filtreVentes, filtres.produit_id ? new Types.ObjectId(filtres.produit_id) : undefined),
      agregerCommandesLivrees(filtreCommandes),
      totaliserEncaissementsValides(filtreEncaissements),
      totaliserDepensesValidees(filtreDepenses),
    ]);
    const unites = await produitService.lireUnites(ventes.lignes.map((ligne) => ligne.produit_id));

    return {
      filtres: {
        date_debut: filtres.date_debut ?? null,
        date_fin: filtres.date_fin ?? null,
        client_id: filtres.client_id ?? null,
        produit_id: filtres.produit_id ?? null,
      },
      ventes_validees: { nombre: ventes.nombre, montant_total: ventes.situation.montant_total },
      quantites_vendues: ventes.lignes.map((ligne) => ({ ...ligne, unite_stock: unites.get(ligne.produit_id) ?? null })),
      commandes_livrees: commandes,
      encaissements,
      soldes: ventes.situation,
      depenses_enregistrees: decimal.additionner('0', ...depenses.map((ligne) => ligne.montant)),
    };
  },
};
