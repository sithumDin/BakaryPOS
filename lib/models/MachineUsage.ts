import mongoose, { Schema } from 'mongoose';

const MachineUsageSchema = new Schema({
  machine: { type: Schema.Types.ObjectId, ref: 'Machine', required: true },
  machineName: { type: String, required: true },
  date: { type: Date, default: Date.now },
  milkPacketsUsed: { type: Number, required: true },
  milkCostPerPacket: { type: Number, required: true },
  dailyRentalFee: { type: Number, default: 0 },
  totalCost: { type: Number, required: true },
  notes: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.models.MachineUsage || mongoose.model('MachineUsage', MachineUsageSchema);
