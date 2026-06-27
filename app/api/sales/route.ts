import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { serialize } from '@/lib/serialize';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_key_change_this_later');

export const dynamic = 'force-dynamic';

async function getSessionUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { id: payload.id as string, role: (payload.role as string) || 'cashier' };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: Record<string, unknown> = {};
    if (type) where.saleType = type;
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, unknown>).gte = new Date(from);
      if (to) (where.date as Record<string, unknown>).lte = new Date(to + 'T23:59:59');
    }

    const sales = await prisma.sale.findMany({
      where,
      include: { items: true },
      orderBy: { date: 'desc' },
      take: limit,
    });
    return Response.json(serialize(sales));
  } catch {
    return Response.json({ error: 'Failed to fetch sales' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    let cashierId: string | null = null;
    let cashierName = 'Admin';
    const token = request.cookies.get('session')?.value;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        cashierId = payload.id as string;
        cashierName = payload.name as string;
      } catch {}
    }

    const body = await request.json();
    const count = await prisma.sale.count();
    const prefix = body.saleType === 'wholesale' ? 'WS' : 'RT';
    const invoiceNo = `${prefix}-${String(count + 1).padStart(5, '0')}`;

    const sale = await prisma.sale.create({
      data: {
        invoiceNo,
        customerName: body.customerName || 'Walk-in Customer',
        subtotal: body.subtotal,
        discount: body.discount || 0,
        otherCharges: body.otherCharges || 0,
        otherChargesDescription: body.otherChargesDescription || '',
        total: body.total,
        profit: body.profit,
        paymentMethod: body.paymentMethod || 'cash',
        saleType: body.saleType || 'retail',
        cashierId,
        cashierName,
        date: body.date ? new Date(body.date) : new Date(),
        items: {
          create: body.items.map((item: any) => ({
            productId: item.product || null,
            productName: item.productName,
            qty: item.qty,
            unitPrice: item.unitPrice,
            costPrice: item.costPrice,
            total: item.total,
          })),
        },
      },
      include: { items: true },
    });

    // Deduct stock for each item
    for (const item of body.items) {
      if (item.product) {
        await prisma.product.update({
          where: { id: item.product },
          data: { stock: { decrement: item.qty } },
        });
      }
    }

    return Response.json(serialize(sale), { status: 201 });
  } catch (error) {
    console.error('Sale creation error:', error);
    return Response.json({ error: 'Failed to create sale' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Only admins can clear sales' }, { status: 403 });

    const result = await prisma.sale.deleteMany({});
    return Response.json({ message: 'Sales cleared successfully', deletedCount: result.count });
  } catch {
    return Response.json({ error: 'Failed to clear sales' }, { status: 500 });
  }
}
