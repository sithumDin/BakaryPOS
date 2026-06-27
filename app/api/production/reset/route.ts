import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    await prisma.$transaction([
      prisma.product.updateMany({ data: { stock: 0 } }),
      prisma.production.deleteMany({ where: { productionDate: { gte: todayStart } } }),
    ]);

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Failed to reset' }, { status: 500 });
  }
}
