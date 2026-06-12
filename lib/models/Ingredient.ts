import mongoose, { Schema } from 'mongoose';

const IngredientSchema = new Schema({
  name: { type: String, required: true },
  category: { type: String, default: 'Raw Material' },
  stock: { type: Number, required: true, default: 0 },
  unit: { type: String, required: true, default: 'kg' },
  lowStockThreshold: { type: Number, default: 5 },
  dailyUsageTarget: { type: Number, default: 0 },
  weeklyUsageTarget: { type: Number, default: 0 },
  monthlyUsageTarget: { type: Number, default: 0 },
  supplier: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.models.Ingredient || mongoose.model('Ingredient', IngredientSchema);
