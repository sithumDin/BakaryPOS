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
    return { id: payload.id as string, name: payload.name as string, role: (payload.role as string) || 'cashier' };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');

    const quotations = await prisma.quotation.findMany({
      where: status ? { status } : undefined,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return Response.json(serialize(quotations));
  } catch {
    return Response.json({ error: 'Failed to fetch quotations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const count = await prisma.quotation.count();
    const prefix = body.quotationType === 'wholesale' ? 'QWS' : 'QRT';
    const quotationNo = `${prefix}-${String(count + 1).padStart(5, '0')}`;

    const quotation = await prisma.quotation.create({
      data: {
        quotationNo,
        customerName: body.customerName || '',
        customerPhone: body.customerPhone || '',
        customerEmail: body.customerEmail || '',
        customerAddress: body.customerAddress || '',
        subtotal: Number(body.subtotal) || 0,
        discount: Number(body.discount) || 0,
        other: Number(body.other) || 0,
        advance: Number(body.advance) || 0,
        total: Number(body.total) || 0,
        notes: body.notes || '',
        validUntil: body.validUntil || '',
        quotationType: body.quotationType || 'retail',
        status: body.status || 'draft',
        createdBy: user.name,
        items: body.items?.length
          ? {
              create: body.items.map((item: any) => ({
                product: item.product || '',
                productName: item.productName || '',
                qty: Number(item.qty) || 0,
                unitPrice: Number(item.unitPrice) || 0,
                unit: item.unit || '',
                total: Number(item.total) || 0,
              })),
            }
          : undefined,
      },
      include: { items: true },
    });

    return Response.json(serialize(quotation), { status: 201 });
  } catch (error) {
    console.error('POST quotation error:', error);
    return Response.json({ error: 'Failed to create quotation' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { _id, items, ...data } = body;
    if (!_id) return Response.json({ error: 'Quotation ID is required' }, { status: 400 });

    const current = await prisma.quotation.findUnique({ where: { id: _id } });
    if (!current) return Response.json({ error: 'Quotation not found' }, { status: 404 });

    const quotation = await prisma.quotation.update({
      where: { id: _id },
      data: {
        customerName: data.customerName ?? current.customerName,
        customerPhone: data.customerPhone ?? current.customerPhone,
        customerEmail: data.customerEmail ?? current.customerEmail,
        customerAddress: data.customerAddress ?? current.customerAddress,
        subtotal: data.subtotal !== undefined ? Number(data.subtotal) : current.subtotal,
        discount: data.discount !== undefined ? Number(data.discount) : current.discount,
        other: data.other !== undefined ? Number(data.other) : current.other,
        advance: data.advance !== undefined ? Number(data.advance) : current.advance,
        total: data.total !== undefined ? Number(data.total) : current.total,
        notes: data.notes ?? current.notes,
        validUntil: data.validUntil ?? current.validUntil,
        quotationType: data.quotationType ?? current.quotationType,
        status: data.status ?? current.status,
        ...(items
          ? {
              items: {
                deleteMany: {},
                create: items.map((item: any) => ({
                  product: item.product || '',
                  productName: item.productName || '',
                  qty: Number(item.qty) || 0,
                  unitPrice: Number(item.unitPrice) || 0,
                  unit: item.unit || '',
                  total: Number(item.total) || 0,
                })),
              },
            }
          : {}),
      },
      include: { items: true },
    });

    // Auto-create credit record when status changes to 'accepted'
    if (data.status === 'accepted' && current.status !== 'accepted') {
      try {
        let customer = await prisma.customer.findFirst({ where: { name: quotation.customerName } });
        if (!customer) {
          customer = await prisma.customer.create({
            data: {
              name: quotation.customerName,
              phone: quotation.customerPhone || '',
              address: quotation.customerAddress || '',
              type: quotation.quotationType,
            },
          });
        }
        const originalAmount = quotation.subtotal - quotation.discount + quotation.other;
        const paidAmount = quotation.advance;
        const remaining = Math.max(0, originalAmount - paidAmount);
        await prisma.credit.create({
          data: {
            customerId: customer.id,
            customerName: quotation.customerName,
            customerPhone: quotation.customerPhone || '',
            saleId: _id,
            invoiceNo: quotation.quotationNo,
            saleType: quotation.quotationType,
            totalAmount: originalAmount,
            paidAmount,
            remainingAmount: remaining,
            status: remaining <= 0 ? 'paid' : 'pending',
          },
        });
      } catch (creditErr) {
        console.error('Credit creation failed:', creditErr);
      }
    }

    return Response.json(serialize(quotation));
  } catch (error) {
    console.error('PUT quotation error:', error);
    return Response.json({ error: 'Failed to update quotation' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return Response.json({ error: 'Quotation ID required' }, { status: 400 });

    await prisma.quotation.delete({ where: { id } });
    return Response.json({ message: 'Quotation deleted' });
  } catch {
    return Response.json({ error: 'Failed to delete quotation' }, { status: 500 });
  }
}
