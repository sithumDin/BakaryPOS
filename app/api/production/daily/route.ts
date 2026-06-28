import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const records = await prisma.dailyProduction.findMany({
      where: { date: { gte: todayStart } },
      include: { item: true },
      orderBy: { date: 'desc' },
    });
    return Response.json(serialize(records));
  } catch {
    return Response.json({ error: 'Failed to fetch records' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { itemId, qty } = await request.json();
    if (!itemId || !qty || qty <= 0) {
      return Response.json({ error: 'itemId and qty required' }, { status: 400 });
    }
    const record = await prisma.dailyProduction.create({
      data: { itemId, qty },
      include: { item: true },
    });
    return Response.json(serialize(record), { status: 201 });
  } catch (e: any) {
    return Response.json({ error: e.message || 'Failed to record' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    await prisma.dailyProduction.deleteMany({ where: { date: { gte: todayStart } } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Failed to reset' }, { status: 500 });
  }
}
