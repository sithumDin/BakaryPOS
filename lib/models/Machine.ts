import mongoose, { Schema } from 'mongoose';

const MachineSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, default: '' },
  milkCostPerPacket: { type: Number, required: true, default: 0 },
  dailyRentalFee: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.Machine || mongoose.model('Machine', MachineSchema);
