import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import MachineUsage from '@/lib/models/MachineUsage';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const range = searchParams.get('range') || 'today';

    const now = new Date();
    let from: Date;

    if (range === 'week') {
      from = new Date(now);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
    } else if (range === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const usage = await MachineUsage.find({ date: { $gte: from } })
      .sort({ date: -1 });
    return Response.json(usage);
  } catch {
    return Response.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { machineId, machineName, milkPacketsUsed, milkCostPerPacket, dailyRentalFee, notes } = body;

    const totalCost = (milkPacketsUsed * milkCostPerPacket) + (dailyRentalFee || 0);

    const record = await MachineUsage.create({
      machine: machineId,
      machineName,
      milkPacketsUsed,
      milkCostPerPacket,
      dailyRentalFee: dailyRentalFee || 0,
      totalCost,
      notes: notes || '',
      date: new Date(),
    });

    return Response.json(record, { status: 201 });
  } catch {
    return Response.json({ error: 'Failed to log usage' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    await MachineUsage.findByIdAndDelete(id);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Failed to delete record' }, { status: 500 });
  }
}
