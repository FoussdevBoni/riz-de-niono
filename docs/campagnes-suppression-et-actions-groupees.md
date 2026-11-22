# Campagnes : suppression des brouillons et sélection dans les listes

`DELETE /api/v1/campagnes-agricoles/:id` retire une campagne en brouillon des listes et des sélecteurs (204). L’action exige l’accès à l’activité Production, la permission de saisie du module et la couverture de tous les sites de la campagne. Une campagne ouverte, clôturée ou déjà liée à une autre fiche ne peut pas être supprimée.

Le document et son code restent conservés en base. Le retrait est enregistré dans le journal comme archivage et la fiche n’est plus accessible par son URL. Il n’y a pas de restauration depuis l’interface.

La sélection porte sur les lignes admissibles de la page courante. Une opération groupée confirme les lignes concernées en une fois, puis appelle le service de chaque ligne. Les refus sont affichés individuellement et les lignes en échec restent sélectionnées pour une éventuelle relance.
