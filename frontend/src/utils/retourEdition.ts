export interface OrigineEdition {
  url: string;
  position: number;
}

export const originesEdition = new Map<string, OrigineEdition>();
export let retourEdition: OrigineEdition | null = null;
export let confirmationEdition: { message: string; fiche?: string; origine: string } | null = null;

export function preparerRetour(origine: OrigineEdition, message: string | null, fiche?: string) {
  retourEdition = origine;
  confirmationEdition = message ? { message, fiche, origine: origine.url } : null;
}

export function consommerRetour() {
  const retour = retourEdition;
  retourEdition = null;
  return retour;
}
