import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import Machine from '@/lib/models/Machine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDB();
    const machines = await Machine.find({}).sort({ createdAt: -1 });
    return Response.json(machines);
  } catch {
    return Response.json({ error: 'Failed to fetch machines' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const machine = await Machine.create(body);
    return Response.json(machine, { status: 201 });
  } catch {
    return Response.json({ error: 'Failed to create machine' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { _id, ...update } = body;
    const machine = await Machine.findByIdAndUpdate(_id, update, { new: true });
    return Response.json(machine);
  } catch {
    return Response.json({ error: 'Failed to update machine' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    await Machine.findByIdAndDelete(id);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Failed to delete machine' }, { status: 500 });
  }
}
