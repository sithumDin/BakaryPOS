import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import Ingredient from '@/lib/models/Ingredient';
import Production from '@/lib/models/Production';

export async function POST(request: NextRequest) {
  try {
    const { productId, qty } = await request.json();
    if (!productId || !qty || qty <= 0) {
      return Response.json({ error: 'productId and qty required' }, { status: 400 });
    }

    await connectDB();

    const product = await Product.findById(productId).lean();
    if (!product) return Response.json({ error: 'Product not found' }, { status: 404 });

    const ingredientsUsed = [];

    // If product has recipe, deduct ingredients
    if (product.ingredients && product.ingredients.length) {
      for (const rec of product.ingredients) {
        const requiredQty = (rec.qty || 0) * qty;
        const ing = await Ingredient.findById(rec.ingredient);
        if (!ing) return Response.json({ error: 'Ingredient not found' }, { status: 404 });
        if (ing.stock < requiredQty) {
          return Response.json({ error: `Insufficient ingredient: ${ing.name}` }, { status: 400 });
        }
        ing.stock -= requiredQty;
        await ing.save();
        ingredientsUsed.push({ ingredient: ing._id, qty: requiredQty });
      }
    }

    // Increase product stock
    const updated = await Product.findByIdAndUpdate(productId, { $inc: { stock: qty } }, { new: true });

    // compute expiryDate based on shelfLifeDays
    const productionDate = new Date();
    const shelfDays = product.shelfLifeDays || 0;
    const expiryDate = shelfDays ? new Date(productionDate.getTime() + shelfDays * 24 * 60 * 60 * 1000) : null;

    // create production record
    await Production.create({ product: productId, qty, productionDate, expiryDate, ingredientsUsed });

    return Response.json({ success: true, product: updated });
  } catch (error) {
    console.error('Produce error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
