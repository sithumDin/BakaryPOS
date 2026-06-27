import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import prisma from '@/lib/db';
import { serialize } from '@/lib/serialize';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_key_change_this_later');

export const dynamic = 'force-dynamic';

async function getSessionUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { id: payload.id as string, name: (payload.name as string) || 'Admin', role: (payload.role as string) || 'cashier' };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const reminders = await prisma.reminder.findMany({
      orderBy: [{ done: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return Response.json(serialize(reminders));
  } catch {
    return Response.json({ error: 'Failed to fetch reminders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Only admins can add reminders' }, { status: 403 });

    const body = await request.json();
    const text = String(body.text || '').trim();
    if (!text) return Response.json({ error: 'Reminder text is required' }, { status: 400 });

    const reminder = await prisma.reminder.create({
      data: { text, done: false, createdById: user.id, createdByName: user.name },
    });
    return Response.json(serialize(reminder), { status: 201 });
  } catch {
    return Response.json({ error: 'Failed to create reminder' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Only admins can update reminders' }, { status: 403 });

    const body = await request.json();
    const id = String(body.id || '');
    const done = Boolean(body.done);
    if (!id) return Response.json({ error: 'Reminder id is required' }, { status: 400 });

    const reminder = await prisma.reminder.update({
      where: { id },
      data: {
        done,
        completedById: done ? user.id : null,
        completedByName: done ? user.name : null,
        completedAt: done ? new Date() : null,
      },
    });
    return Response.json(serialize(reminder));
  } catch {
    return Response.json({ error: 'Failed to update reminder' }, { status: 500 });
  }
}
