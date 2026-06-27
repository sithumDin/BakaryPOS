import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const saleType = searchParams.get('saleType');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (saleType) where.saleType = saleType;

    const credits = await prisma.credit.findMany({
      where,
      include: { payments: { orderBy: { date: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return Response.json(serialize(credits));
  } catch {
    return Response.json({ error: 'Failed to fetch credits' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const credit = await prisma.credit.create({
      data: {
        customerName: body.customerName,
        customerPhone: body.customerPhone || '',
        saleId: body.sale,
        invoiceNo: body.invoiceNo,
        saleType: body.saleType || 'wholesale',
        totalAmount: body.totalAmount,
        paidAmount: body.paidAmount || 0,
        remainingAmount: body.remainingAmount,
        status: body.status || 'pending',
        payments: body.payments?.length
          ? { create: body.payments.map((p: any) => ({ amount: p.amount, date: new Date(p.date), note: p.note || '' })) }
          : undefined,
      },
      include: { payments: true },
    });
    return Response.json(serialize(credit), { status: 201 });
  } catch {
    return Response.json({ error: 'Failed to create credit record' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { creditId, payment } = body;

    const credit = await prisma.credit.findUnique({
      where: { id: creditId },
      include: { payments: true },
    });
    if (!credit) return Response.json({ error: 'Credit record not found' }, { status: 404 });

    const newPaid = credit.paidAmount + payment.amount;
    const newRemaining = credit.totalAmount - newPaid;
    const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

    const updated = await prisma.credit.update({
      where: { id: creditId },
      data: {
        paidAmount: newPaid,
        remainingAmount: Math.max(0, newRemaining),
        status: newStatus,
        payments: {
          create: { amount: payment.amount, date: new Date(payment.date || Date.now()), note: payment.note || '' },
        },
      },
      include: { payments: { orderBy: { date: 'desc' } } },
    });
    return Response.json(serialize(updated));
  } catch {
    return Response.json({ error: 'Failed to update credit' }, { status: 500 });
  }
}
