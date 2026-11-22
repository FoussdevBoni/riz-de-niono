import { Schema } from 'mongoose';

/** Une culture (et sa variété) sur un site pour une campagne. */
export const cultureSchema = new Schema(
  {
    campagne_id: { type: Schema.Types.ObjectId, required: true },
    site_id: { type: Schema.Types.ObjectId, required: true },
    culture: { type: String, required: true, trim: true },
    variete: { type: String, default: null, trim: true },
    superficie_ha: { type: Schema.Types.Decimal128, required: true },
    date_semis: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);

cultureSchema.index({ campagne_id: 1, site_id: 1 });
