import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_key_change_this_later');

async function getAdminFromRequest(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== 'admin') return null;
    return payload;
  } catch {
    return null;
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    if (String(admin.id) === id) {
      return Response.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }
    const user = await prisma.user.delete({ where: { id } }).catch(() => null);
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
