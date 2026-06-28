import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const logs = await prisma.dailyIngredientLog.findMany({
      where: { date: { gte: todayStart } },
      orderBy: { date: 'asc' },
    });
    return Response.json(serialize(logs));
  } catch {
    return Response.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, qty, unit } = await request.json();
    if (!name || !qty || qty <= 0) return Response.json({ error: 'name and qty required' }, { status: 400 });
    const log = await prisma.dailyIngredientLog.create({ data: { name: name.trim(), qty, unit: unit || 'kg' } });
    return Response.json(serialize(log), { status: 201 });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (id) {
      await prisma.dailyIngredientLog.delete({ where: { id } });
    } else {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      await prisma.dailyIngredientLog.deleteMany({ where: { date: { gte: todayStart } } });
    }
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Failed to clear' }, { status: 500 });
  }
}
