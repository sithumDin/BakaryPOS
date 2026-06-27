import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { serialize } from '@/lib/serialize';

export async function POST(request: NextRequest) {
  try {
    const { originalProductId, convertedProductId, originalQty, convertedQty } = await request.json();
    if (!originalProductId || !convertedProductId || !originalQty || !convertedQty) {
      return Response.json({ error: 'Missing conversion parameters' }, { status: 400 });
    }

    const [orig, conv] = await Promise.all([
      prisma.product.findUnique({ where: { id: originalProductId } }),
      prisma.product.findUnique({ where: { id: convertedProductId } }),
    ]);
    if (!orig || !conv) return Response.json({ error: 'Product(s) not found' }, { status: 404 });
    if (orig.stock < originalQty) return Response.json({ error: 'Insufficient original product stock' }, { status: 400 });

    const [updatedOrig, updatedConv] = await prisma.$transaction([
      prisma.product.update({ where: { id: originalProductId }, data: { stock: { decrement: originalQty } } }),
      prisma.product.update({ where: { id: convertedProductId }, data: { stock: { increment: convertedQty } } }),
    ]);

    await prisma.conversion.create({
      data: { originalProductId, convertedProductId, originalQty, convertedQty },
    });

    return Response.json({ success: true, original: serialize(updatedOrig), converted: serialize(updatedConv) });
  } catch (error) {
    console.error('Convert error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
