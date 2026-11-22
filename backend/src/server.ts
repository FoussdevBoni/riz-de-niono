import { creerApplication } from './app.js';
import { configuration } from './config/configuration.js';
import { connecterMongo, deconnecterMongo } from './database/connexionMongo.js';
import { parametreEntrepriseService } from './modules/parametres-entreprise/services/parametreEntrepriseService.js';
import { typeDepenseService } from './modules/types-depenses/services/typeDepenseService.js';

async function demarrer(): Promise<void> {
  await connecterMongo();
  // Référentiels de référence attendus par les modules (document 03 : type « Entretien du matériel »).
  await typeDepenseService.assurerTypesReference();
  await parametreEntrepriseService.assurerParametres();

  const serveur = creerApplication().listen(configuration.port, () => {
    console.log(`API Riz de Niono : http://localhost:${configuration.port}${configuration.prefixeApi}`);
  });

  const arreter = () => {
    serveur.close(() => {
      void deconnecterMongo().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', arreter);
  process.on('SIGTERM', arreter);
}

demarrer().catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exit(1);
});
