import mongoose, { Schema } from 'mongoose';

const InventoryTransactionSchema = new Schema({
  ingredient: { type: Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  type: { type: String, enum: ['purchase', 'usage', 'adjustment', 'waste'], required: true },
  qty: { type: Number, required: true },
  unit: { type: String, required: true },
  note: { type: String, default: '' },
  reference: { type: String, default: '' },
  transactionDate: { type: Date, default: Date.now },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.models.InventoryTransaction || mongoose.model('InventoryTransaction', InventoryTransactionSchema);
