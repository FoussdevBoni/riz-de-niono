import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { Children, isValidElement, useState, type ReactNode } from 'react';

type TonAlerte = 'information' | 'succes' | 'attention' | 'erreur';

const ICONES = { information: Info, succes: CircleCheck, attention: TriangleAlert, erreur: CircleAlert };

function texteMessage(contenu: ReactNode): string {
  return Children.toArray(contenu).map((element) => {
    if (typeof element === 'string' || typeof element === 'number') return String(element);
    return isValidElement<{ children?: ReactNode }>(element) ? texteMessage(element.props.children) : '';
  }).join(' ');
}

export function Alerte({ ton = 'information', titre, children, onFermer }: {
  ton?: TonAlerte;
  titre?: string;
  children?: ReactNode;
  onFermer?: () => void;
}) {
  return <Banniere key={JSON.stringify([ton, titre, texteMessage(children)])} ton={ton} titre={titre} onFermer={onFermer}>{children}</Banniere>;
}

function Banniere({ ton, titre, children, onFermer }: {
  ton: TonAlerte;
  titre?: string;
  children?: ReactNode;
  onFermer?: () => void;
}) {
  const [fermee, setFermee] = useState(false);
  if (fermee) return null;
  const Icone = ICONES[ton];

  return (
    <div className={`alerte alerte--${ton}`}>
      <Icone className="alerte__icone" size={18} aria-hidden="true" />
      <div className="alerte__contenu" role={ton === 'erreur' || ton === 'attention' ? 'alert' : 'status'}>
        {titre && <p className="alerte__titre">{titre}</p>}
        {children && <div className="alerte__texte">{children}</div>}
      </div>
      <button type="button" className="alerte__fermer" aria-label="Fermer le message" onClick={() => {
        setFermee(true);
        onFermer?.();
      }}>
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
