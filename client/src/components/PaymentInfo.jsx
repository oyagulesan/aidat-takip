import { useEffect, useRef, useState } from 'react';

const BANK = {
  name: 'Akbank',
  iban: 'TR460004600695888000231603',
  holder: 'Oya Benlioğlu Güleşan',
};

/** 'TR4600...' -> 'TR46 0004 6006 ...' for readability; the raw value is what gets copied. */
const groupIban = (iban) => iban.replace(/(.{4})/g, '$1 ').trim();

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Denied (e.g. embedded webviews / permissions policy) — fall through to the legacy path.
    }
  }
  const ta = Object.assign(document.createElement('textarea'), { value: text, readOnly: true });
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('copy failed');
}

export default function PaymentInfo() {
  const [toast, setToast] = useState(null); // { text, error }
  const timer = useRef();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async (value, label) => {
    let next;
    try {
      await copyText(value);
      next = { text: `${label} kopyalandı` };
    } catch {
      next = { text: `${label} kopyalanamadı`, error: true };
    }
    setToast(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="card payment-info">
      <h3>Ödeme bilgileri</h3>
      <div className="pi-bank">{BANK.name}</div>
      <div className="pi-row">
        <span className="pi-label">IBAN</span>
        <span className="pi-value mono">{groupIban(BANK.iban)}</span>
        <button className="btn btn-small" onClick={() => copy(BANK.iban, 'IBAN')}>Kopyala</button>
      </div>
      <div className="pi-row">
        <span className="pi-label">İsim</span>
        <span className="pi-value">{BANK.holder}</span>
        <button className="btn btn-small" onClick={() => copy(BANK.holder, 'İsim')}>Kopyala</button>
      </div>
      {toast && (
        <div className={`toast ${toast.error ? 'toast-error' : ''}`} role="status" aria-live="polite">
          {toast.error ? '✕' : '✓'} {toast.text}
        </div>
      )}
    </div>
  );
}
