import mongoose, { Schema } from 'mongoose';

const ProductionSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  qty: { type: Number, required: true },
  productionDate: { type: Date, default: Date.now },
  expiryDate: { type: Date },
  ingredientsUsed: [{
    ingredient: { type: Schema.Types.ObjectId, ref: 'Ingredient' },
    qty: { type: Number }
  }],
  producedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.models.Production || mongoose.model('Production', ProductionSchema);
