import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import bcrypt from 'bcryptjs';

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

export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await connectDB();
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    return Response.json(users);
  } catch {
    return Response.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await connectDB();
    const { name, username, password, role } = await request.json();

    if (!name || !username || !password) {
      return Response.json({ error: 'Name, username and password are required' }, { status: 400 });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return Response.json({ error: 'Username already exists' }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, username, password: hashed, role: role || 'cashier' });

    return Response.json({ _id: user._id, name: user.name, username: user.username, role: user.role }, { status: 201 });
  } catch {
    return Response.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
