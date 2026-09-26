import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import DataTable from '../components/DataTable.jsx';
import Breakdown from '../components/Breakdown.jsx';
import { breakdown, todayISO } from '../format.js';
import { paymentColumns } from '../paymentColumns.jsx';

export default function NewDelivery() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/payments?undelivered=1').then(setRows).catch((e) => setError(e.message));
  }, []);

  const columns = useMemo(() => paymentColumns({ showDelivery: false }), []);
  const selectedRows = useMemo(() => (rows || []).filter((r) => selected.has(r.id)), [rows, selected]);
  const summary = breakdown(selectedRows);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/deliveries', { delivery_date: date, description, payment_ids: [...selected] });
      navigate('/teslimatlar');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="page-head">
        <h2>Teslimat Girişi</h2>
      </div>

      <div className="delivery-layout">
        <div className="delivery-list">
          <p className="muted">
            Teslim edilmemiş ödemeler listelenir. Teslimata dahil edilecek ödemeleri seçin (satıra tıklayarak ya da
            başlıktaki kutu ile filtrelenmiş listenin tümünü).
          </p>
          {!rows ? (
            <div className="muted">Yükleniyor…</div>
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              defaultSort={{ key: 'created_at', dir: 'desc' }}
              selectable
              selected={selected}
              onSelectedChange={setSelected}
              emptyText="Teslim edilmemiş ödeme yok"
            />
          )}
        </div>

        <aside className="card delivery-summary">
          <h3>Seçilen ödemeler</h3>
          <Breakdown {...summary} />
          {selected.size > 0 && (
            <button className="btn btn-link" onClick={() => setSelected(new Set())}>Seçimi temizle</button>
          )}
          <hr />
          <label className="field">
            <span>Teslimat tarihi *</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="field">
            <span>Açıklama</span>
            <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          {error && <div className="alert error">{error}</div>}
          <div className="form-actions">
            <button className="btn" onClick={() => navigate('/teslimatlar')}>İptal</button>
            <button className="btn btn-primary" disabled={busy || selected.size === 0 || !date} onClick={save}>
              {busy ? 'Kaydediliyor…' : `Teslimatı kaydet (${selected.size})`}
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
