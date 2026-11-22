import { Schema } from 'mongoose';

/** Session ouverte à la connexion. Seul le condensat SHA-256 du jeton est conservé. */
export const sessionSchema = new Schema(
  {
    utilisateur_id: { type: Schema.Types.ObjectId, required: true, index: true },
    jeton_hash: { type: String, required: true, unique: true },
    expire_at: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false },
);

// Index TTL : MongoDB supprime la session une fois expire_at dépassé.
sessionSchema.index({ expire_at: 1 }, { expireAfterSeconds: 0 });
