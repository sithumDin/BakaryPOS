import mongoose, { Schema } from 'mongoose';

const CreditPaymentSchema = new Schema({
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  note: { type: String, default: '' },
}, { _id: false });

const CreditSchema = new Schema({
  customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
  customerName: { type: String, required: true },
  customerPhone: { type: String, default: '' },
  sale: { type: Schema.Types.ObjectId, ref: 'Sale', required: true },
  invoiceNo: { type: String, required: true },
  saleType: { type: String, enum: ['retail', 'wholesale'], default: 'wholesale' },
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number, required: true },
  payments: [CreditPaymentSchema],
  status: { type: String, enum: ['pending', 'partial', 'paid'], default: 'pending' },
}, { timestamps: true });

export default mongoose.models.Credit || mongoose.model('Credit', CreditSchema);
