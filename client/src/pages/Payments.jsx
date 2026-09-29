import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import DataTable from '../components/DataTable.jsx';
import Breakdown from '../components/Breakdown.jsx';
import { breakdown, formatMoney, formatMonth } from '../format.js';
import { paymentColumns } from '../paymentColumns.jsx';
import MissingMonths from '../components/MissingMonths.jsx';
import PaymentInfo from '../components/PaymentInfo.jsx';
import { useAuth } from '../auth.jsx';

export default function Payments({ isAdmin }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null); // own missing aidat months (users only)
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const load = () => api.get('/payments').then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    if (!isAdmin) api.get(`/members/${user.id}/status`).then(setStatus).catch((e) => setError(e.message));
  }, []);

  const columns = useMemo(() => paymentColumns({ showMember: isAdmin }), [isAdmin]);

  const exportExcel = async () => {
    setExporting(true);
    try {
      await api.download('/reports/excel');
    } catch (e) {
      alert(e.message);
    } finally {
      setExporting(false);
    }
  };

  const remove = async (p) => {
    if (!confirm(`${p.member_name} – ${formatMonth(p.period)} – ${formatMoney(p.amount)} ödemesi silinsin mi?`)) return;
    try {
      await api.del(`/payments/${p.id}`);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <section>
      <div className="page-head">
        <h2>{isAdmin ? 'Ödemeler' : 'Ödemelerim'}</h2>
        {isAdmin && (
          <div className="head-actions">
            <button className="btn" onClick={exportExcel} disabled={exporting}>
              {exporting ? 'Hazırlanıyor…' : "Excel'e aktar"}
            </button>
            <Link className="btn btn-primary" to="/odeme/yeni">+ Ödeme Girişi</Link>
          </div>
        )}
      </div>
      {error && <div className="alert error">{error}</div>}
      <PaymentInfo />
      {status && <MissingMonths months={status.missing_months} member={status.member} />}
      {!rows ? (
        <div className="muted">Yükleniyor…</div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          defaultSort={{ key: 'created_at', dir: 'desc' }}
          emptyText="Henüz ödeme yok"
          footer={(visible) => <Breakdown title="Listelenen toplam" {...breakdown(visible)} />}
          actions={
            isAdmin
              ? (p) =>
                  p.delivery_id ? (
                    <span className="muted small" title="Teslim edilmiş ödemeler değiştirilemez">🔒</span>
                  ) : (
                    <>
                      <button className="btn btn-small" onClick={() => navigate(`/odeme/${p.id}`)}>Düzenle</button>
                      <button className="btn btn-small btn-danger" onClick={() => remove(p)}>Sil</button>
                    </>
                  )
              : undefined
          }
        />
      )}
    </section>
  );
}
