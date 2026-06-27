import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

function getPeriodStart(period: string) {
  const now = new Date();
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'day') { const s = new Date(now); s.setHours(0, 0, 0, 0); return s; }
  const s = new Date(now);
  s.setDate(s.getDate() - s.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
}

export async function GET(request: NextRequest) {
  try {
    const period = request.nextUrl.searchParams.get('period') || 'week';
    const ingredients = await prisma.ingredient.findMany({ orderBy: { createdAt: 'desc' } });

    const lowStockItems = ingredients.filter((i) => i.stock <= i.lowStockThreshold);

    let usageSummary: { ingredientId: string; name: string; qty: number; unit: string }[] = [];
    let dailySummary: { ingredientId: string; name: string; unit: string; openingStock: number; topupToday: number; usedToday: number; remaining: number }[] = [];

    if (period === 'day') {
      const start = getPeriodStart('day');
      const txs = await prisma.inventoryTransaction.findMany({
        where: { transactionDate: { gte: start } },
        include: { ingredient: { select: { id: true, name: true, unit: true } } },
      });
      const txMap: Record<string, { topup: number; used: number }> = {};
      for (const tx of txs) {
        const key = tx.ingredientId;
        if (!txMap[key]) txMap[key] = { topup: 0, used: 0 };
        if (tx.qty > 0) txMap[key].topup += tx.qty;
        else txMap[key].used += Math.abs(tx.qty);
      }
      dailySummary = ingredients
        .map((ing) => {
          const { topup = 0, used = 0 } = txMap[ing.id] || {};
          const remaining = ing.stock;
          const openingStock = remaining - topup + used;
          return { ingredientId: ing.id, name: ing.name, unit: ing.unit, openingStock: Math.max(0, openingStock), topupToday: topup, usedToday: used, remaining };
        })
        .filter((item) => item.openingStock > 0 || item.topupToday > 0 || item.usedToday > 0 || item.remaining > 0);
    } else {
      const start = getPeriodStart(period);
      const txs = await prisma.inventoryTransaction.findMany({
        where: { type: 'usage', transactionDate: { gte: start } },
        include: { ingredient: { select: { id: true, name: true, unit: true } } },
      });
      const usageMap: Record<string, { ingredientId: string; name: string; qty: number; unit: string }> = {};
      for (const tx of txs) {
        const key = tx.ingredientId;
        if (!usageMap[key]) usageMap[key] = { ingredientId: key, name: tx.ingredient.name, qty: 0, unit: tx.ingredient.unit };
        usageMap[key].qty += Math.abs(tx.qty);
      }
      usageSummary = Object.values(usageMap).sort((a, b) => b.qty - a.qty);
    }

    return Response.json({ ingredients: serialize(ingredients), lowStockItems: serialize(lowStockItems), usageSummary, dailySummary, period });
  } catch (error) {
    console.error('Inventory GET error:', error);
    return Response.json({ error: 'Failed to load inventory data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.ingredientId) {
      const ingredient = await prisma.ingredient.findUnique({ where: { id: body.ingredientId } });
      if (!ingredient) return Response.json({ error: 'Ingredient not found' }, { status: 404 });

      const qty = Number(body.qty) || 0;
      if (qty <= 0) return Response.json({ error: 'qty must be greater than 0' }, { status: 400 });

      const movementType = body.type || 'usage';
      const signedQty = movementType === 'purchase' || movementType === 'adjustment' ? qty : -qty;
      const newStock = Math.max(0, ingredient.stock + signedQty);

      const [updatedIngredient, transaction] = await prisma.$transaction([
        prisma.ingredient.update({ where: { id: body.ingredientId }, data: { stock: newStock } }),
        prisma.inventoryTransaction.create({
          data: {
            ingredientId: body.ingredientId,
            type: movementType,
            qty: signedQty,
            unit: ingredient.unit,
            note: body.note || '',
            reference: body.reference || '',
            transactionDate: body.transactionDate ? new Date(body.transactionDate) : new Date(),
          },
        }),
      ]);

      return Response.json({ ingredient: serialize(updatedIngredient), transaction: serialize(transaction) }, { status: 201 });
    }

    const ingredient = await prisma.ingredient.create({
      data: {
        name: body.name,
        category: body.category || 'Raw Material',
        stock: Number(body.stock) || 0,
        unit: body.unit || 'kg',
        lowStockThreshold: Number(body.lowStockThreshold) || 5,
        dailyUsageTarget: Number(body.dailyUsageTarget) || 0,
        weeklyUsageTarget: Number(body.weeklyUsageTarget) || 0,
        monthlyUsageTarget: Number(body.monthlyUsageTarget) || 0,
        supplier: body.supplier || '',
        notes: body.notes || '',
      },
    });
    return Response.json(serialize(ingredient), { status: 201 });
  } catch (error) {
    console.error('Inventory POST error:', error);
    return Response.json({ error: 'Failed to save inventory item' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { _id, ...data } = body;
    if (!_id) return Response.json({ error: 'Ingredient ID is required' }, { status: 400 });

    const ingredient = await prisma.ingredient.update({
      where: { id: _id },
      data: {
        name: data.name,
        category: data.category,
        stock: Number(data.stock) || 0,
        unit: data.unit,
        lowStockThreshold: Number(data.lowStockThreshold) || 5,
        dailyUsageTarget: Number(data.dailyUsageTarget) || 0,
        weeklyUsageTarget: Number(data.weeklyUsageTarget) || 0,
        monthlyUsageTarget: Number(data.monthlyUsageTarget) || 0,
        supplier: data.supplier || '',
        notes: data.notes || '',
      },
    });
    return Response.json(serialize(ingredient));
  } catch {
    return Response.json({ error: 'Failed to update inventory item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return Response.json({ error: 'Ingredient ID required' }, { status: 400 });
    await prisma.ingredient.delete({ where: { id } });
    return Response.json({ message: 'Ingredient deleted' });
  } catch {
    return Response.json({ error: 'Failed to delete inventory item' }, { status: 500 });
  }
}
