import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alerte } from '../../components/Alerte';
import { BlocRequete } from '../../components/BlocRequete';
import { DialogueAction } from '../../components/DialogueAction';
import { EnTetePage } from '../../components/EnTetePage';
import { FicheDonnees } from '../../components/FicheDonnees';
import { PastilleStatut } from '../../components/PastilleStatut';
import { useActiviteCourante } from '../../hooks/useActiviteCourante';
import { useRequete } from '../../hooks/useRequete';
import { useSession } from '../../modules/authentification/hooks/useSession';
import { possedePermission } from '../../modules/authentification/utils/permissions';
import { useProduitsReference } from '../../modules/produits/hooks/useProduitsReference';
import { stockService } from '../../modules/stock/services/stockService';
import type { FicheMouvementStock } from '../../modules/stock/types/stockTypes';
import { lienOrigine } from '../../modules/stock/utils/lienOrigine';
import { LIBELLES_ORIGINE, LIBELLES_SENS } from '../../modules/stock/utils/libellesStock';
import { messageStockInsuffisant } from '../../modules/stock/utils/messageStock';
import { useUtilisateursReference } from '../../modules/utilisateurs/hooks/useUtilisateursReference';
import { formaterQuantite } from '../../utils/formatage';

const dateHeure = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Seule une écriture manuelle se corrige, une seule fois (contre-écriture unique) ; une écriture générée se corrige
 * par son opération d'origine et une contre-écriture ne se corrige pas (409 correction_par_origine, document 04).
 */
function estCorrigeable(mouvement: FicheMouvementStock): boolean {
  return mouvement.origine.type === 'manuel' && !mouvement.contre_ecriture_id;
}

/**
 * /:activite/mouvements-stock/:id : fiche d'un mouvement, son origine (avec lien vers l'opération si
 * l'utilisateur peut la consulter) et la contre-écriture éventuelle. Corriger (stock + validation) crée la
 * contre-écriture d'une écriture manuelle, avec motif.
 */
export function MouvementStockPage() {
  const { id = '' } = useParams();
  const { profil } = useSession();
  const activite = useActiviteCourante();
  const requete = useRequete((signal) => stockService.consulterMouvement(id, signal), [id]);
  const produits = useProduitsReference(profil);
  const utilisateurs = useUtilisateursReference(profil);
  const [dialogue, setDialogue] = useState(false);
  const [contreEcriture, setContreEcriture] = useState<FicheMouvementStock | null>(null);
  const base = `/${activite}/mouvements-stock`;
  const mouvement = requete.donnees;
  const peutCorriger = mouvement ? estCorrigeable(mouvement) && possedePermission(profil, 'stock', 'validation') : false;

  return (
    <section className="page-etroite">
      <EnTetePage
        retour={{ to: base, libelle: 'Retour aux mouvements' }}
        titre="Mouvement de stock"
        sousTitre={mouvement ? dateHeure.format(new Date(mouvement.date_mouvement)) : undefined}
        actions={
          peutCorriger && (
            <button type="button" className="bouton bouton--danger" onClick={() => setDialogue(true)}>
              Corriger
            </button>
          )
        }
      />
      {contreEcriture && (
        <Alerte ton="succes" titre="Contre-écriture créée">
          <p>
            {LIBELLES_SENS[contreEcriture.sens]} de{' '}
            {formaterQuantite(contreEcriture.quantite, produits.find((element) => element._id === contreEcriture.produit_id)?.unite_stock)} enregistrée le{' '}
            {dateHeure.format(new Date(contreEcriture.date_mouvement))} · motif : {contreEcriture.motif}.{' '}
            <Link to={`${base}/${contreEcriture._id}`}>Ouvrir la contre-écriture</Link>
          </p>
        </Alerte>
      )}
      {mouvement && mouvement.origine.type !== 'manuel' && mouvement.origine.type !== 'correction' && possedePermission(profil, 'stock', 'validation') && (
        <p className="texte-doux">Mouvement généré par une opération : il se corrige en annulant ou en corrigeant l’opération d’origine.</p>
      )}
      <BlocRequete {...requete} cartes={0} libelleChargement="Chargement du mouvement…">
        {(fiche) => {
          const produit = produits.find((element) => element._id === fiche.produit_id);
          const lien = lienOrigine(profil, fiche.origine.type, fiche.origine.id, activite);
          const auteur = utilisateurs.find((utilisateur) => utilisateur._id === fiche.utilisateur_id);
          return (
            <FicheDonnees
              lignes={[
                ['Produit', produit ? `${produit.nom} (${produit.code})` : fiche.produit_nom ?? 'Produit hors catalogue'],
                ['Sens', <PastilleStatut key="sens" libelle={LIBELLES_SENS[fiche.sens]} ton={fiche.sens === 'entree' ? 'succes' : 'attention'} />],
                ['Quantité', formaterQuantite(fiche.quantite, produit?.unite_stock)],
                [
                  'Origine',
                  <span key="origine">
                    {LIBELLES_ORIGINE[fiche.origine.type]}
                    {fiche.origine.type !== 'manuel' && fiche.origine.type !== 'correction' && (
                      <>
                        {' · '}
                        {lien ? <Link to={lien}>Ouvrir l’opération d’origine</Link> : <span className="texte-doux">Opération d’origine indisponible</span>}
                      </>
                    )}
                  </span>,
                ],
                [
                  'Contre-écriture de',
                  fiche.annule_mouvement_id ? (
                    <Link key="annule" to={`${base}/${fiche.annule_mouvement_id}`}>
                      Mouvement initial
                    </Link>
                  ) : null,
                ],
                [
                  'Annulé par',
                  fiche.contre_ecriture_id ? (
                    <Link key="contre" to={`${base}/${fiche.contre_ecriture_id}`}>
                      Contre-écriture
                    </Link>
                  ) : null,
                ],
                ['Motif', fiche.motif],
                ['Enregistré par', fiche.utilisateur_id ? (auteur?.nom ?? 'Nom de l’auteur indisponible') : null],
                ['Date', dateHeure.format(new Date(fiche.date_mouvement))],
                ['Clé du mouvement', <code key="cle">{fiche.cle_mouvement}</code>],
              ]}
            />
          );
        }}
      </BlocRequete>
      {dialogue && mouvement && (
        <DialogueAction
          titre="Corriger cette écriture manuelle ?"
          libelleConfirmer="Créer la contre-écriture"
          danger
          motif
          onFermer={() => setDialogue(false)}
          onConfirmer={async (motif) => {
            try {
              setContreEcriture(await stockService.corrigerMouvement(id, motif));
            } catch (cause) {
              const stock = messageStockInsuffisant(cause, produits, 'Le mouvement n’a pas été corrigé.');
              if (stock) throw new Error(stock.message);
              throw cause;
            }
            setDialogue(false);
            requete.recharger();
          }}
        >
          <p>
            Le mouvement initial est conservé et un mouvement inverse ({mouvement.sens === 'entree' ? 'sortie' : 'entrée'} de{' '}
            {formaterQuantite(mouvement.quantite, produits.find((element) => element._id === mouvement.produit_id)?.unite_stock)}) lui est lié.
          </p>
        </DialogueAction>
      )}
    </section>
  );
}
