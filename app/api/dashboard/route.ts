import prisma from '@/lib/db';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

function fallback() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dailyProfits = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dailyProfits.push({ date: d.toISOString().split('T')[0], profit: 0, revenue: 0 });
  }
  return {
    today: { revenue: 0, profit: 0, count: 0 },
    week: { revenue: 0, profit: 0 },
    month: { revenue: 0, profit: 0 },
    year: { revenue: 0, profit: 0 },
    totalCustomers: 0,
    totalProducts: 0,
    lowStockProducts: 0,
    lowStockList: [],
    totalOutstanding: 0,
    creditBreakdown: { retail: { amount: 0, count: 0 }, wholesale: { amount: 0, count: 0 } },
    productionSummary: { totalProduced: 0, totalSold: 0, totalUnsold: 0, byItem: {} },
    recentSales: [],
    dailyProfits,
    categoryBreakdown: {},
    cashierBreakdown: {},
  };
}

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [todaySales, weekSales, monthSales, yearSales, totalCustomers, totalProducts, allProducts, pendingCredits, todayProductions, recentSales] =
      await Promise.all([
        prisma.sale.findMany({ where: { date: { gte: todayStart } }, include: { items: true } }),
        prisma.sale.findMany({ where: { date: { gte: weekStart } }, select: { total: true, profit: true } }),
        prisma.sale.findMany({ where: { date: { gte: monthStart } }, include: { items: true } }),
        prisma.sale.findMany({ where: { date: { gte: yearStart } }, select: { total: true, profit: true } }),
        prisma.customer.count(),
        prisma.product.count(),
        prisma.product.findMany({ select: { id: true, stock: true, lowStockThreshold: true, name: true, category: true, unit: true } }),
        prisma.credit.findMany({ where: { status: { not: 'paid' } }, select: { remainingAmount: true, saleType: true } }),
        prisma.production.findMany({
          where: { productionDate: { gte: todayStart } },
          include: { product: { select: { id: true, name: true, unit: true } } },
        }),
        prisma.sale.findMany({ orderBy: { date: 'desc' }, take: 10, include: { items: true } }),
      ]);

    // Today
    const todayRevenue = todaySales.reduce((s, x) => s + x.total, 0);
    const todayProfit = todaySales.reduce((s, x) => s + x.profit, 0);
    const todayCount = todaySales.length;

    const cashierBreakdown: Record<string, { revenue: number; count: number }> = {};
    for (const sale of todaySales) {
      const name = (sale as any).cashierName || 'Admin';
      if (!cashierBreakdown[name]) cashierBreakdown[name] = { revenue: 0, count: 0 };
      cashierBreakdown[name].revenue += sale.total;
      cashierBreakdown[name].count += 1;
    }

    // Periods
    const weekRevenue = weekSales.reduce((s, x) => s + x.total, 0);
    const weekPr = weekSales.reduce((s, x) => s + x.profit, 0);
    const monthRevenue = monthSales.reduce((s, x) => s + x.total, 0);
    const monthPr = monthSales.reduce((s, x) => s + x.profit, 0);
    const yearRevenue = yearSales.reduce((s, x) => s + x.total, 0);
    const yearPr = yearSales.reduce((s, x) => s + x.profit, 0);

    // Low stock
    const lowStockList = allProducts.filter((p) => p.stock <= p.lowStockThreshold);

    // Credits
    const totalOutstanding = pendingCredits.reduce((s, c) => s + c.remainingAmount, 0);
    const retailPending = pendingCredits.filter((c) => c.saleType === 'retail');
    const wholePending = pendingCredits.filter((c) => c.saleType !== 'retail');
    const creditBreakdown = {
      retail: { amount: retailPending.reduce((s, c) => s + c.remainingAmount, 0), count: retailPending.length },
      wholesale: { amount: wholePending.reduce((s, c) => s + c.remainingAmount, 0), count: wholePending.length },
    };

    // Production vs sales
    const productionByItem: Record<string, { name: string; unit: string; produced: number; sold: number }> = {};
    for (const p of todayProductions) {
      const id = p.productId;
      if (!productionByItem[id]) {
        productionByItem[id] = { name: p.product.name, unit: p.product.unit, produced: 0, sold: 0 };
      }
      productionByItem[id].produced += p.qty;
    }
    for (const sale of todaySales) {
      for (const item of sale.items) {
        const id = item.productId;
        if (id && productionByItem[id]) {
          productionByItem[id].sold += item.qty;
        }
      }
    }
    const totalProducedToday = Object.values(productionByItem).reduce((s, v) => s + v.produced, 0);
    const totalSoldToday = Object.values(productionByItem).reduce((s, v) => s + v.sold, 0);

    // 7-day daily chart
    const dailyProfits = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(todayStart);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const daySales = await prisma.sale.findMany({
        where: { date: { gte: dayStart, lt: dayEnd } },
        select: { total: true, profit: true },
      });
      dailyProfits.push({
        date: dayStart.toISOString().split('T')[0],
        profit: daySales.reduce((s, x) => s + x.profit, 0),
        revenue: daySales.reduce((s, x) => s + x.total, 0),
      });
    }

    // Category breakdown (this month)
    const productMap = Object.fromEntries(allProducts.map((p) => [p.id, p.category]));
    const categoryMap: Record<string, number> = {};
    for (const sale of monthSales) {
      for (const item of sale.items) {
        const cat = (item.productId ? productMap[item.productId] : null) || 'Other';
        categoryMap[cat] = (categoryMap[cat] || 0) + item.total;
      }
    }

    return Response.json({
      today: { revenue: todayRevenue, profit: todayProfit, count: todayCount },
      week: { revenue: weekRevenue, profit: weekPr },
      month: { revenue: monthRevenue, profit: monthPr },
      year: { revenue: yearRevenue, profit: yearPr },
      totalCustomers,
      totalProducts,
      lowStockProducts: lowStockList.length,
      lowStockList: serialize(lowStockList),
      totalOutstanding,
      creditBreakdown,
      productionSummary: {
        totalProduced: totalProducedToday,
        totalSold: totalSoldToday,
        totalUnsold: Math.max(0, totalProducedToday - totalSoldToday),
        byItem: productionByItem,
      },
      recentSales: serialize(recentSales),
      dailyProfits,
      categoryBreakdown: categoryMap,
      cashierBreakdown,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return Response.json(fallback());
  }
}
