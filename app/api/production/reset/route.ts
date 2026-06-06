import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import Production from '@/lib/models/Production';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await connectDB();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Reset all product stocks to 0
    await Product.updateMany({}, { $set: { stock: 0 } });

    // Delete today's production records so the log & totals clear
    await Production.deleteMany({ productionDate: { $gte: todayStart } });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Failed to reset' }, { status: 500 });
  }
}
