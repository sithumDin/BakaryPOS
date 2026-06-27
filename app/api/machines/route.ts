import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const machines = await prisma.machine.findMany({ orderBy: { createdAt: 'desc' } });
    return Response.json(serialize(machines));
  } catch {
    return Response.json({ error: 'Failed to fetch machines' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const machine = await prisma.machine.create({
      data: {
        name: body.name,
        type: body.type || '',
        milkCostPerPacket: Number(body.milkCostPerPacket) || 0,
        dailyRentalFee: Number(body.dailyRentalFee) || 0,
        notes: body.notes || '',
        isActive: body.isActive !== false,
      },
    });
    return Response.json(serialize(machine), { status: 201 });
  } catch {
    return Response.json({ error: 'Failed to create machine' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { _id, ...data } = body;
    if (!_id) return Response.json({ error: 'Machine ID required' }, { status: 400 });
    const machine = await prisma.machine.update({
      where: { id: _id },
      data: {
        name: data.name,
        type: data.type || '',
        milkCostPerPacket: Number(data.milkCostPerPacket) || 0,
        dailyRentalFee: Number(data.dailyRentalFee) || 0,
        notes: data.notes || '',
        isActive: data.isActive !== false,
      },
    });
    return Response.json(serialize(machine));
  } catch {
    return Response.json({ error: 'Failed to update machine' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return Response.json({ error: 'Machine ID required' }, { status: 400 });
    await prisma.machine.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Failed to delete machine' }, { status: 500 });
  }
}
