import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import DataTable from '../components/DataTable.jsx';
import Breakdown from '../components/Breakdown.jsx';
import MissingMonths from '../components/MissingMonths.jsx';
import PaymentInfo from '../components/PaymentInfo.jsx';
import PendingDelivery from '../components/PendingDelivery.jsx';
import { breakdown } from '../format.js';
import { paymentColumns } from '../paymentColumns.jsx';

/** Landing page for everyone: own payments and missing aidat; admins also get the delivery hint. */
export default function Home() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState(null);
  const [undelivered, setUndelivered] = useState(null); // admin only
  const [error, setError] = useState('');

  useEffect(() => {
    const fail = (e) => setError(e.message);
    api.get(`/payments?member_id=${user.id}`).then(setRows).catch(fail);
    api.get(`/members/${user.id}/status`).then(setStatus).catch(fail);
    if (isAdmin) api.get('/payments?undelivered=1').then(setUndelivered).catch(fail);
  }, [user.id, isAdmin]);

  const columns = useMemo(() => paymentColumns({ showMember: false }), []);

  return (
    <section>
      <div className="page-head">
        <h2>Ödemelerim</h2>
      </div>
      {error && <div className="alert error">{error}</div>}
      {isAdmin && <PendingDelivery payments={undelivered} />}
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
        />
      )}
    </section>
  );
}
