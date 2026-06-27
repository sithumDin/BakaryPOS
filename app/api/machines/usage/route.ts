import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const range = request.nextUrl.searchParams.get('range') || 'today';
    const now = new Date();
    let from: Date;

    if (range === 'week') {
      from = new Date(now);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
    } else if (range === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const usage = await prisma.machineUsage.findMany({
      where: { date: { gte: from } },
      orderBy: { date: 'desc' },
    });
    return Response.json(serialize(usage));
  } catch {
    return Response.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { machineId, machineName, milkPacketsUsed, milkCostPerPacket, dailyRentalFee, notes } = body;
    const totalCost = milkPacketsUsed * milkCostPerPacket + (dailyRentalFee || 0);

    const record = await prisma.machineUsage.create({
      data: {
        machineId,
        machineName,
        milkPacketsUsed: Number(milkPacketsUsed),
        milkCostPerPacket: Number(milkCostPerPacket),
        dailyRentalFee: Number(dailyRentalFee) || 0,
        totalCost,
        notes: notes || '',
        date: new Date(),
      },
    });
    return Response.json(serialize(record), { status: 201 });
  } catch {
    return Response.json({ error: 'Failed to log usage' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return Response.json({ error: 'ID required' }, { status: 400 });
    await prisma.machineUsage.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Failed to delete record' }, { status: 500 });
  }
}
