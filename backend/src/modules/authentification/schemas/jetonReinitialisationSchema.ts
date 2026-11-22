import { Schema } from 'mongoose';

/** Jeton de réinitialisation à usage unique, conservé sous forme de condensat SHA-256. */
export const jetonReinitialisationSchema = new Schema(
  {
    utilisateur_id: { type: Schema.Types.ObjectId, required: true, index: true },
    jeton_hash: { type: String, required: true, unique: true },
    expire_at: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false },
);

jetonReinitialisationSchema.index({ expire_at: 1 }, { expireAfterSeconds: 0 });
