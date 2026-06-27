import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    return Response.json(serialize(products));
  } catch {
    return Response.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const retailPrice = Number(body.retailPrice ?? body.sellingPrice ?? 0);
    const wholesalePrice = Number(body.wholesalePrice ?? body.sellingPrice ?? 0);

    const product = await prisma.product.create({
      data: {
        name: body.name,
        category: body.category || 'Other',
        costPrice: Number(body.costPrice) || 0,
        retailPrice,
        wholesalePrice,
        sellingPrice: retailPrice,
        stock: Number(body.stock) || 0,
        unit: body.unit || 'pcs',
        lowStockThreshold: Number(body.lowStockThreshold) || 10,
        shelfLifeDays: Number(body.shelfLifeDays) || 3,
      },
    });
    return Response.json(serialize(product), { status: 201 });
  } catch (error: any) {
    console.error('Database Error:', error);
    return Response.json({ error: error.message || 'Failed to create product' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { _id, ...data } = body;
    if (!_id) return Response.json({ error: 'Product ID required' }, { status: 400 });

    const retailPrice = Number(data.retailPrice ?? data.sellingPrice ?? 0);
    const wholesalePrice = Number(data.wholesalePrice ?? data.sellingPrice ?? 0);

    const product = await prisma.product.update({
      where: { id: _id },
      data: {
        name: data.name,
        category: data.category || 'Other',
        costPrice: Number(data.costPrice) || 0,
        retailPrice,
        wholesalePrice,
        sellingPrice: retailPrice,
        stock: Number(data.stock) || 0,
        unit: data.unit || 'pcs',
        lowStockThreshold: Number(data.lowStockThreshold) || 10,
        shelfLifeDays: Number(data.shelfLifeDays) || 3,
      },
    });
    return Response.json(serialize(product));
  } catch {
    return Response.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { _id, topup } = body;
    if (!_id || typeof topup !== 'number' || topup <= 0) {
      return Response.json({ error: 'Valid product ID and positive topup amount required' }, { status: 400 });
    }
    const product = await prisma.product.update({
      where: { id: _id },
      data: { stock: { increment: topup } },
    });
    return Response.json(serialize(product));
  } catch {
    return Response.json({ error: 'Failed to top up product stock' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return Response.json({ error: 'Product ID required' }, { status: 400 });
    await prisma.product.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
