import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import Ingredient from '@/lib/models/Ingredient';
import InventoryTransaction from '@/lib/models/InventoryTransaction';

export const dynamic = 'force-dynamic';

function getPeriodStart(period: string) {
  const now = new Date();

  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // default weekly window
  const start = new Date(now);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
}

async function getUsageSummary(period: string) {
  const start = getPeriodStart(period);
  const transactions = await InventoryTransaction.find({
    type: 'usage',
    transactionDate: { $gte: start },
  }).populate('ingredient', 'name unit');

  const usageMap: Record<string, { ingredientId: string; name: string; qty: number; unit: string }> = {};

  for (const tx of transactions) {
    const ingredient = tx.ingredient as any;
    const key = ingredient?._id?.toString() || tx.ingredient.toString();

    if (!usageMap[key]) {
      usageMap[key] = {
        ingredientId: key,
        name: ingredient?.name || 'Unknown',
        qty: 0,
        unit: ingredient?.unit || tx.unit,
      };
    }

    usageMap[key].qty += Math.abs(tx.qty);
  }

  return Object.values(usageMap).sort((a, b) => b.qty - a.qty);
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const period = searchParams.get('period') || 'week';

    const ingredients = await Ingredient.find({}).sort({ createdAt: -1 });
    const lowStockItems = ingredients.filter((item) => item.stock <= item.lowStockThreshold);
    const usageSummary = await getUsageSummary(period);

    return Response.json({
      ingredients,
      lowStockItems,
      usageSummary,
      period,
    });
  } catch (error) {
    console.error('Inventory GET error:', error);
    return Response.json({ error: 'Failed to load inventory data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    // If ingredientId is supplied, this is a stock movement transaction.
    if (body.ingredientId) {
      const ingredient = await Ingredient.findById(body.ingredientId);
      if (!ingredient) {
        return Response.json({ error: 'Ingredient not found' }, { status: 404 });
      }

      const qty = Number(body.qty) || 0;
      if (qty <= 0) {
        return Response.json({ error: 'qty must be greater than 0' }, { status: 400 });
      }

      const movementType = body.type || 'usage';
      const signedQty = movementType === 'purchase' || movementType === 'adjustment'
        ? qty
        : -qty;

      ingredient.stock += signedQty;
      if (ingredient.stock < 0) ingredient.stock = 0;
      await ingredient.save();

      const transaction = await InventoryTransaction.create({
        ingredient: ingredient._id,
        type: movementType,
        qty: signedQty,
        unit: ingredient.unit,
        note: body.note || '',
        reference: body.reference || '',
        transactionDate: body.transactionDate || new Date(),
      });

      return Response.json({ ingredient, transaction }, { status: 201 });
    }

    const ingredient = await Ingredient.create({
      name: body.name,
      category: body.category || 'Raw Material',
      stock: Number(body.stock) || 0,
      unit: body.unit || 'kg',
      lowStockThreshold: Number(body.lowStockThreshold) || 5,
      weeklyUsageTarget: Number(body.weeklyUsageTarget) || 0,
      monthlyUsageTarget: Number(body.monthlyUsageTarget) || 0,
      supplier: body.supplier || '',
      notes: body.notes || '',
    });

    return Response.json(ingredient, { status: 201 });
  } catch (error) {
    console.error('Inventory POST error:', error);
    return Response.json({ error: 'Failed to save inventory item' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { _id, ...data } = body;

    if (!_id) {
      return Response.json({ error: 'Ingredient ID is required' }, { status: 400 });
    }

    const ingredient = await Ingredient.findByIdAndUpdate(
      _id,
      {
        name: data.name,
        category: data.category,
        stock: Number(data.stock) || 0,
        unit: data.unit,
        lowStockThreshold: Number(data.lowStockThreshold) || 5,
        weeklyUsageTarget: Number(data.weeklyUsageTarget) || 0,
        monthlyUsageTarget: Number(data.monthlyUsageTarget) || 0,
        supplier: data.supplier || '',
        notes: data.notes || '',
      },
      { new: true, runValidators: true }
    );

    if (!ingredient) {
      return Response.json({ error: 'Ingredient not found' }, { status: 404 });
    }

    return Response.json(ingredient);
  } catch (error) {
    console.error('Inventory PUT error:', error);
    return Response.json({ error: 'Failed to update inventory item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Ingredient ID required' }, { status: 400 });
    }

    await Ingredient.findByIdAndDelete(id);
    await InventoryTransaction.deleteMany({ ingredient: id });

    return Response.json({ message: 'Ingredient deleted' });
  } catch (error) {
    console.error('Inventory DELETE error:', error);
    return Response.json({ error: 'Failed to delete inventory item' }, { status: 500 });
  }
}
