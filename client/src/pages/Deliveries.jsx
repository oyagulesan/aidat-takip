import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import DataTable from '../components/DataTable.jsx';
import Breakdown from '../components/Breakdown.jsx';
import MonthlyBreakdown from '../components/MonthlyBreakdown.jsx';
import { PAYMENT_TYPES, formatDate, formatMoney } from '../format.js';
import { paymentColumns } from '../paymentColumns.jsx';

const columns = [
  { key: 'delivery_date', label: 'Teslimat tarihi', text: (d) => formatDate(d.delivery_date) },
  { key: 'description', label: 'Açıklama', render: (d) => <span className="desc">{d.description}</span> },
  { key: 'payment_count', label: 'Ödeme adedi', align: 'right' },
  ...PAYMENT_TYPES.map((t) => ({
    key: `type_${t.value}`,
    label: t.label,
    align: 'right',
    value: (d) => d.by_type[t.value] || 0,
    text: (d) => formatMoney(d.by_type[t.value] || 0),
  })),
  { key: 'total', label: 'Toplam', align: 'right', text: (d) => formatMoney(d.total), render: (d) => <strong>{formatMoney(d.total)}</strong> },
];

export default function Deliveries() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null); // { delivery, payments }

  const load = () => api.get('/deliveries').then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const showDetail = async (d) => {
    if (detail?.delivery.id === d.id) return setDetail(null);
    try {
      setDetail({ delivery: d, payments: await api.get(`/deliveries/${d.id}/payments`) });
    } catch (e) {
      alert(e.message);
    }
  };

  const remove = async (d) => {
    if (!confirm(`${formatDate(d.delivery_date)} tarihli teslimat silinsin mi? İçindeki ${d.payment_count} ödeme tekrar "teslim edilmedi" durumuna döner.`)) return;
    try {
      await api.del(`/deliveries/${d.id}`);
      if (detail?.delivery.id === d.id) setDetail(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const detailColumns = useMemo(() => paymentColumns({ showDelivery: false }), []);

  return (
    <section>
      <div className="page-head">
        <h2>Teslimatlar</h2>
        <Link className="btn btn-primary" to="/teslimatlar/yeni">+ Teslimat Girişi</Link>
      </div>
      {error && <div className="alert error">{error}</div>}
      {!rows ? (
        <div className="muted">Yükleniyor…</div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          defaultSort={{ key: 'delivery_date', dir: 'desc' }}
          emptyText="Henüz teslimat yok"
          footer={(visible) => {
            const byType = {};
            for (const d of visible) for (const [k, v] of Object.entries(d.by_type)) byType[k] = (byType[k] || 0) + v;
            const total = visible.reduce((s, d) => s + d.total, 0);
            const count = visible.reduce((s, d) => s + d.payment_count, 0);
            return <Breakdown title="Listelenen teslimatların toplamı" total={total} byType={byType} count={count} />;
          }}
          actions={(d) => (
            <>
              <button className="btn btn-small" onClick={() => showDetail(d)}>
                {detail?.delivery.id === d.id ? 'Gizle' : 'Ödemeler'}
              </button>
              <button className="btn btn-small btn-danger" onClick={() => remove(d)}>Sil</button>
            </>
          )}
        />
      )}

      {detail && (
        <div className="card detail">
          <div className="page-head">
            <h3>
              {formatDate(detail.delivery.delivery_date)} teslimatındaki ödemeler
              {detail.delivery.description && <span className="muted"> – {detail.delivery.description}</span>}
            </h3>
            <button className="btn btn-small" onClick={() => setDetail(null)}>Kapat</button>
          </div>
          <DataTable
            columns={detailColumns}
            rows={detail.payments}
            defaultSort={{ key: 'created_at', dir: 'desc' }}
            footer={(visible) => <MonthlyBreakdown payments={visible} />}
          />
        </div>
      )}
    </section>
  );
}
