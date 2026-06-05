import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import Conversion from '@/lib/models/Conversion';

export async function POST(request: NextRequest) {
  try {
    const { originalProductId, convertedProductId, originalQty, convertedQty } = await request.json();
    if (!originalProductId || !convertedProductId || !originalQty || !convertedQty) {
      return Response.json({ error: 'Missing conversion parameters' }, { status: 400 });
    }

    await connectDB();

    const orig = await Product.findById(originalProductId);
    const conv = await Product.findById(convertedProductId);
    if (!orig || !conv) return Response.json({ error: 'Product(s) not found' }, { status: 404 });
    if (orig.stock < originalQty) return Response.json({ error: 'Insufficient original product stock' }, { status: 400 });

    orig.stock -= originalQty;
    conv.stock += convertedQty;
    await orig.save();
    await conv.save();

    await Conversion.create({ originalProduct: originalProductId, convertedProduct: convertedProductId, originalQty, convertedQty });

    return Response.json({ success: true, original: orig, converted: conv });
  } catch (error) {
    console.error('Convert error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
