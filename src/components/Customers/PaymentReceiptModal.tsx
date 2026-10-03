import React, { useRef, useState } from 'react';
import { X, Share2, Download, Loader2, AlertCircle } from 'lucide-react';
import { fmtINR } from '../../utils/format';
import type { BusinessProfile, Customer, PaymentReceipt } from '../../types';

interface SelectedPayment extends PaymentReceipt {
  balanceAfter: number; // running ledger balance immediately after this payment
}

interface Props {
  customer: Customer;
  businessProfile: BusinessProfile | null;
  payments: SelectedPayment[]; // chronological order, oldest first
  openingBalance: number;      // ledger balance just before the earliest selected payment
  onClose: () => void;
}

function balSuffix(b: number): string {
  return b > 0 ? 'Dr' : b < 0 ? 'Cr' : 'Nil';
}

// The card is a fixed ~340px wide, so a long business name needs a smaller
// font to have any chance of fitting on one line — scale down by length
// rather than letting it wrap to two lines or overflow.
function businessNameFontSize(name: string): number {
  if (name.length <= 20) return 18;
  if (name.length <= 28) return 16;
  if (name.length <= 36) return 14;
  return 12;
}

function fileSafeDate(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}

// The captured card below is built entirely from inline styles rather than
// Tailwind classes, and from flex rows rather than an HTML <table>. Both the
// column-width auto-layout algorithm for <table> and the resolution of
// stylesheet-based utility classes can come out slightly different inside
// html2canvas's cloned render vs. the live DOM, which shifted text out of
// alignment in the downloaded image on some devices. Inline styles and fixed
// flex-basis widths leave nothing for the clone to recompute.
const COL = { date: '26%', mode: '44%', amount: '30%' };

export default function PaymentReceiptModal({ customer, businessProfile, payments, openingBalance, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'share' | 'download' | null>(null);
  const [error, setError] = useState('');

  const totalReceived = payments.reduce((s, p) => s + p.amount, 0);
  const closingBalance = payments.length > 0 ? payments[payments.length - 1].balanceAfter : openingBalance;
  const fileName = `Receipt-${customer.id}-${fileSafeDate()}.png`;

  const renderCanvas = async () => {
    if (!cardRef.current) throw new Error('Receipt not ready yet');
    // Wait for fonts so html2canvas measures text with the same metrics the
    // live page used — otherwise a not-yet-loaded font swap mid-capture can
    // reflow text differently than what was on screen.
    if (document.fonts?.ready) await document.fonts.ready;
    const { default: html2canvas } = await import('html2canvas');
    // Pin the clone's layout viewport to the real one. The card's own width
    // comes from percentage-based ancestors (w-full inside a flex overlay),
    // so if html2canvas were left to pick its own window size (or were
    // pinned to the card's own offsetWidth) that percentage would resolve
    // against the wrong number and the card would re-wrap on capture.
    return html2canvas(cardRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
    });
  };

  const toBlob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not generate image'))), 'image/png');
    });

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    setError('');
    setBusy('share');
    try {
      const blob = await toBlob(await renderCanvas());
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Payment Receipt', text: `Payment receipt for ${customer.name}` });
      } else {
        downloadBlob(blob);
        setError('Direct share isn’t supported on this browser — image downloaded instead. Attach it to WhatsApp manually.');
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        // user cancelled the native share sheet — not an error
      } else {
        setError(e instanceof Error ? e.message : 'Failed to generate image');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    setError('');
    setBusy('download');
    try {
      downloadBlob(await toBlob(await renderCanvas()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate image');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="w-full max-w-sm my-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold text-sm">Payment Receipt · {payments.length} entr{payments.length === 1 ? 'y' : 'ies'}</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X size={20} /></button>
        </div>

        {/* ── Captured receipt card — inline styles only, see COL note above ── */}
        <div
          ref={cardRef}
          style={{
            background: '#ffffff', borderRadius: 12, padding: 20,
            color: '#111827', fontFamily: 'Arial, Helvetica, sans-serif',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)', boxSizing: 'border-box',
          }}
        >
          {businessProfile && (
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{
                fontSize: businessNameFontSize(businessProfile.name), fontWeight: 700, lineHeight: 1.4,
                whiteSpace: 'nowrap',
              }}>
                {businessProfile.name}
              </div>
              {businessProfile.address1 && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {businessProfile.address1}{businessProfile.address2 ? `, ${businessProfile.address2}` : ''}, {businessProfile.city} – {businessProfile.state}
                </div>
              )}
              {businessProfile.mobile && <div style={{ fontSize: 12, color: '#6b7280' }}>Ph: {businessProfile.mobile}</div>}
            </div>
          )}

          <div style={{ borderTop: '1px dashed #d1d5db', margin: '8px 0' }} />

          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ color: '#15803d', fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>
              PAYMENT RECEIPT
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{new Date().toLocaleString('en-IN')}</div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{customer.name}</div>
            {customer.firmName && <div style={{ fontSize: 12, color: '#6b7280' }}>{customer.firmName}</div>}
            <div style={{ fontSize: 12, color: '#6b7280' }}>Ph: {customer.mobile}</div>
          </div>

          {/* ── Payments — flex "table" so column widths are fixed, not auto-measured ── */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontSize: 12, fontWeight: 600, paddingBottom: 4, marginBottom: 2 }}>
            <div style={{ width: COL.date }}>Date</div>
            <div style={{ width: COL.mode }}>Mode</div>
            <div style={{ width: COL.amount, textAlign: 'right' }}>Amount</div>
          </div>
          {payments.map(p => (
            <div key={p.id} style={{ display: 'flex', borderBottom: '1px solid #f3f4f6', fontSize: 12, padding: '6px 0', alignItems: 'flex-start' }}>
              <div style={{ width: COL.date, whiteSpace: 'nowrap' }}>{p.date}</div>
              <div style={{ width: COL.mode, paddingRight: 6 }}>
                <div>{p.mode}</div>
                {p.referenceNo && <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 1 }}>{p.referenceNo}</div>}
              </div>
              <div style={{ width: COL.amount, textAlign: 'right', fontWeight: 600, color: '#15803d' }}>{fmtINR(p.amount)}</div>
            </div>
          ))}
          <div style={{ display: 'flex', paddingTop: 6, fontSize: 12, fontWeight: 700 }}>
            <div style={{ width: `calc(${COL.date} + ${COL.mode})` }}>Total Received</div>
            <div style={{ width: COL.amount, textAlign: 'right', color: '#15803d' }}>{fmtINR(totalReceived)}</div>
          </div>

          <div style={{ borderTop: '1px dashed #d1d5db', margin: '10px 0' }} />

          <div style={{ fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#6b7280' }}>Opening Balance</span>
              <span style={{ fontWeight: 600 }}>
                {fmtINR(Math.abs(openingBalance))} <span style={{ fontSize: 10, color: '#9ca3af' }}>{balSuffix(openingBalance)}</span>
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#6b7280' }}>Payment Received</span>
              <span style={{ fontWeight: 700 }}>− {fmtINR(totalReceived)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid #e5e7eb' }}>
              <span style={{ fontWeight: 700 }}>Closing Balance</span>
              <span style={{ fontWeight: 700 }}>
                {fmtINR(Math.abs(closingBalance))} <span style={{ fontSize: 10, color: '#9ca3af' }}>{balSuffix(closingBalance)}</span>
              </span>
            </div>
          </div>

          <div style={{ borderTop: '1px dashed #d1d5db', margin: '12px 0' }} />
          <div style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>
            Thank you for your payment!
            {businessProfile?.upiId && <div style={{ marginTop: 2 }}>UPI: {businessProfile.upiId}</div>}
          </div>
        </div>

        {/* ── Actions (outside the captured card) ── */}
        {error && (
          <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleDownload}
            disabled={busy !== null}
            className="flex-1 flex items-center justify-center gap-2 bg-white text-gray-700 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {busy === 'download' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Download
          </button>
          <button
            onClick={handleShare}
            disabled={busy !== null}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {busy === 'share' ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
