/** Auteur d'une action du back-office (pour la traçabilité). */
export interface Actor {
  userId: string;
  ipHash: string | null;
}
