import { useState } from 'react';

import { DialogueAction } from './DialogueAction';

/**
 * Archiver ou réactiver un élément depuis sa fiche (PATCH actif=false/true), après confirmation.
 * Le refus de l'API (élément utilisé, référence protégée) s'affiche dans le dialogue.
 */
export function BoutonArchivage({
  actif,
  nature,
  consequence,
  onBasculer,
}: {
  actif: boolean;
  /** « ce produit », « cette catégorie »… */
  nature: string;
  consequence?: string;
  onBasculer: (actif: boolean) => Promise<void>;
}) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button type="button" className={actif ? 'bouton bouton--danger' : 'bouton'} onClick={() => setOuvert(true)}>
        {actif ? 'Archiver' : 'Réactiver'}
      </button>
      {ouvert && (
        <DialogueAction
          titre={actif ? `Archiver ${nature} ?` : `Réactiver ${nature} ?`}
          libelleConfirmer={actif ? 'Archiver' : 'Réactiver'}
          danger={actif}
          onFermer={() => setOuvert(false)}
          onConfirmer={async () => {
            await onBasculer(!actif);
            setOuvert(false);
          }}
        >
          <p>{actif ? (consequence ?? 'Il ne sera plus proposé dans les nouvelles saisies ; l’historique reste consultable.') : 'Il sera de nouveau proposé dans les saisies.'}</p>
        </DialogueAction>
      )}
    </>
  );
}
