import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

const includeRecipe = {
  recipe: { include: { ingredient: { select: { id: true, name: true, unit: true, stock: true, costPrice: true } } } },
};

export async function GET() {
  try {
    const items = await prisma.productionItem.findMany({
      orderBy: { createdAt: 'asc' },
      include: includeRecipe,
    });
    return Response.json(serialize(items));
  } catch {
    return Response.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const item = await prisma.productionItem.create({
      data: {
        name: body.name,
        unit: body.unit || 'pcs',
        category: body.category || 'Bakery',
        photo: body.photo || '',
        retailPrice: Number(body.retailPrice) || 0,
        wholesalePrice: Number(body.wholesalePrice) || 0,
        recipe: body.recipe?.length
          ? { create: body.recipe.map((r: { ingredientId: string; qtyPerUnit: number }) => ({ ingredientId: r.ingredientId, qtyPerUnit: r.qtyPerUnit })) }
          : undefined,
      },
      include: includeRecipe,
    });
    return Response.json(serialize(item), { status: 201 });
  } catch (e: any) {
    return Response.json({ error: e.message || 'Failed to create item' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { _id, recipe, ...data } = body;
    if (!_id) return Response.json({ error: 'ID required' }, { status: 400 });

    // Replace recipe: delete all existing, recreate
    await prisma.productionItemIngredient.deleteMany({ where: { itemId: _id } });
    const item = await prisma.productionItem.update({
      where: { id: _id },
      data: {
        name: data.name,
        unit: data.unit,
        category: data.category,
        photo: data.photo ?? undefined,
        retailPrice: Number(data.retailPrice) || 0,
        wholesalePrice: Number(data.wholesalePrice) || 0,
        recipe: recipe?.length
          ? { create: recipe.map((r: { ingredientId: string; qtyPerUnit: number }) => ({ ingredientId: r.ingredientId, qtyPerUnit: r.qtyPerUnit })) }
          : undefined,
      },
      include: includeRecipe,
    });
    return Response.json(serialize(item));
  } catch (e: any) {
    return Response.json({ error: e.message || 'Failed to update item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return Response.json({ error: 'ID required' }, { status: 400 });
    await prisma.productionItem.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
