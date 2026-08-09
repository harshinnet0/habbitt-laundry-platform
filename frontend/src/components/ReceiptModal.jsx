import React, { useRef } from 'react';
import { WashingMachine, Download, Printer, CheckCircle2, X, ShieldCheck, CreditCard, Calendar, Clock } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const ReceiptModal = ({ booking, onClose }) => {
  const receiptRef = useRef();

  if (!booking) return null;

  const handleDownloadPDF = async () => {
    const element = receiptRef.current;
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Habbitt_Receipt_${booking.bookingId || 'laundry'}.pdf`);
    } catch (err) {
      alert('Generating PDF... Printing page as fallback.');
      window.print();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-orange-100 relative my-8">
        
        {/* Top Header Actions */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-orange-600" />
            <span className="font-bold text-sm text-slate-800 uppercase tracking-wider">Payment Receipt</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              className="p-2 text-orange-600 hover:bg-orange-50 rounded-xl transition-all font-semibold text-xs flex items-center gap-1.5 border border-orange-200"
              title="Download PDF Receipt"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div ref={receiptRef} className="p-6 sm:p-8 bg-white text-slate-900">
          
          {/* Company Branding */}
          <div className="text-center pb-6 border-b border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white mx-auto flex items-center justify-center shadow-orange-glow mb-3">
              <WashingMachine className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Habbitt Smart Laundry</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Habbitt Laundry Solutions Pvt. Ltd.</p>
            <p className="text-xs text-slate-400">Station #1 (Main Hub) • Support: support@habbitt.com</p>
          </div>

          {/* Amount Badge */}
          <div className="my-6 bg-orange-50 p-4 rounded-2xl border border-orange-200 text-center">
            <span className="text-xs font-bold text-orange-700 uppercase tracking-wider block">Total Paid</span>
            <span className="text-3xl font-extrabold text-slate-900">₹{booking.amount || 60}.00</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 mt-2 rounded-full text-xs font-bold bg-orange-600 text-white">
              <CheckCircle2 className="w-3 h-3" /> PAYMENT SUCCESSFUL
            </span>
          </div>

          {/* Details Table */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Receipt / Booking ID:</span>
              <span className="font-mono font-bold text-slate-900">{booking.bookingId}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Customer Name:</span>
              <span className="font-semibold text-slate-900">{booking.userName}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Customer Phone:</span>
              <span className="font-mono text-slate-900">{booking.userPhone || '9876543210'}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-orange-600" /> RFID Card UID:
              </span>
              <span className="font-mono font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                {booking.rfidCardId}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Booking Date:
              </span>
              <span className="font-medium text-slate-900">{booking.date}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Booked Slot:
              </span>
              <span className="font-bold text-slate-900">{booking.timeSlot}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Payment Mode:</span>
              <span className="font-medium text-slate-900">{booking.paymentMethod || 'UPI / QR Code'}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Transaction ID:</span>
              <span className="font-mono text-xs text-slate-700">{booking.paymentTransactionId || 'TXN' + Date.now()}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Machine Assigned:</span>
              <span className="font-semibold text-slate-900">{booking.machineName || 'Habbitt Ultra Wash X1'}</span>
            </div>
          </div>

          {/* QR Verification Placeholder */}
          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <div className="w-24 h-24 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center border border-slate-200 mb-2 p-2">
              {/* SVG Mock QR */}
              <svg viewBox="0 0 100 100" className="w-full h-full text-slate-800">
                <rect width="100" height="100" fill="#ffffff" />
                <rect x="10" y="10" width="30" height="30" fill="#000000" />
                <rect x="15" y="15" width="20" height="20" fill="#ffffff" />
                <rect x="20" y="20" width="10" height="10" fill="#000000" />
                
                <rect x="60" y="10" width="30" height="30" fill="#000000" />
                <rect x="65" y="15" width="20" height="20" fill="#ffffff" />
                <rect x="70" y="20" width="10" height="10" fill="#000000" />

                <rect x="10" y="60" width="30" height="30" fill="#000000" />
                <rect x="15" y="65" width="20" height="20" fill="#ffffff" />
                <rect x="20" y="70" width="10" height="10" fill="#000000" />

                <rect x="50" y="50" width="10" height="10" fill="#EA580C" />
                <rect x="70" y="50" width="20" height="10" fill="#000000" />
                <rect x="50" y="70" width="10" height="20" fill="#000000" />
                <rect x="70" y="70" width="15" height="15" fill="#000000" />
              </svg>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Scan this QR code at machine scanner or tap your RFID Card <span className="font-mono text-orange-600 font-bold">{booking.rfidCardId}</span> to start washing!
            </p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 rounded-b-3xl flex gap-3">
          <button
            onClick={handleDownloadPDF}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-orange-glow flex items-center justify-center gap-2 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF Receipt</span>
          </button>
          <button
            onClick={onClose}
            className="py-3 px-5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-sm rounded-xl transition-all"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
