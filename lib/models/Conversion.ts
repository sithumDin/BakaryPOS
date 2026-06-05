import mongoose, { Schema } from 'mongoose';

const ConversionSchema = new Schema({
  originalProduct: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  convertedProduct: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  originalQty: { type: Number, required: true },
  convertedQty: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  handledBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.models.Conversion || mongoose.model('Conversion', ConversionSchema);
