import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const records = await prisma.production.findMany({
      where: { productionDate: { gte: todayStart } },
      include: { product: { select: { id: true, name: true, category: true, unit: true } } },
      orderBy: { productionDate: 'desc' },
    });

    return Response.json(serialize(records));
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

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return Response.json({ error: 'Product not found' }, { status: 404 });

    const productionDate = new Date();
    const expiryDate = product.shelfLifeDays
      ? new Date(productionDate.getTime() + product.shelfLifeDays * 24 * 60 * 60 * 1000)
      : null;

    const [updatedProduct, record] = await prisma.$transaction([
      prisma.product.update({ where: { id: productId }, data: { stock: { increment: qty } } }),
      prisma.production.create({
        data: { productId, qty, productionDate, expiryDate },
      }),
    ]);

    const populated = await prisma.production.findUnique({
      where: { id: record.id },
      include: { product: { select: { id: true, name: true, category: true, unit: true } } },
    });

    return Response.json(serialize({ success: true, product: updatedProduct, record: populated }));
  } catch (error) {
    console.error('Produce error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
