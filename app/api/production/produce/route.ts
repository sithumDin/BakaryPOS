import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import Production from '@/lib/models/Production';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDB();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const records = await Production.find({
      productionDate: { $gte: todayStart, $lte: todayEnd },
    })
      .populate('product', 'name category unit')
      .sort({ createdAt: -1 });

    return Response.json(records);
  } catch {
    return Response.json({ error: 'Failed to fetch production records' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { productId, qty } = await request.json();
    if (!productId || !qty || qty <= 0) {
      return Response.json({ error: 'productId and qty required' }, { status: 400 });
    }

    await connectDB();

    const product = await Product.findById(productId).lean() as { _id: string; name: string; shelfLifeDays?: number } | null;
    if (!product) return Response.json({ error: 'Product not found' }, { status: 404 });

    // Add qty to product stock
    const updated = await Product.findByIdAndUpdate(productId, { $inc: { stock: qty } }, { new: true });

    const productionDate = new Date();
    const shelfDays = product.shelfLifeDays || 0;
    const expiryDate = shelfDays
      ? new Date(productionDate.getTime() + shelfDays * 24 * 60 * 60 * 1000)
      : null;

    const record = await Production.create({ product: productId, qty, productionDate, expiryDate, ingredientsUsed: [] });
    const populated = await record.populate('product', 'name category unit');

    return Response.json({ success: true, product: updated, record: populated });
  } catch (error) {
    console.error('Produce error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
