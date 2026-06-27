import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
    return Response.json(serialize(customers));
  } catch {
    return Response.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        phone: body.phone || '',
        address: body.address || '',
        type: body.type || 'retail',
      },
    });
    return Response.json(serialize(customer), { status: 201 });
  } catch {
    return Response.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { _id, ...data } = body;
    if (!_id) return Response.json({ error: 'Customer ID required' }, { status: 400 });
    const customer = await prisma.customer.update({
      where: { id: _id },
      data: {
        name: data.name,
        phone: data.phone || '',
        address: data.address || '',
        type: data.type || 'retail',
      },
    });
    return Response.json(serialize(customer));
  } catch {
    return Response.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return Response.json({ error: 'Customer ID required' }, { status: 400 });
    await prisma.customer.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}
