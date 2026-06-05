import mongoose, { Schema } from 'mongoose';

const ProductSchema = new Schema({
  name: { type: String, required: true },
  category: { type: String, required: true, default: 'Other' },
  costPrice: { type: Number, required: true, default: 0 },
  retailPrice: { type: Number, required: true, default: 0 },
  wholesalePrice: { type: Number, required: true, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  stock: { type: Number, required: true, default: 0 },
  unit: { type: String, required: true, default: 'pcs' },
  lowStockThreshold: { type: Number, default: 10 },
  // Ingredients recipe: list of ingredients and required quantity per unit of product
  ingredients: [{
    ingredient: { type: Schema.Types.ObjectId, ref: 'Ingredient' },
    qty: { type: Number, default: 0 }
  }],
  // Shelf life in days for produced batches (optional)
  shelfLifeDays: { type: Number, default: 3 },
}, { timestamps: true });

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
