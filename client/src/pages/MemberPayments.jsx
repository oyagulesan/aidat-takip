import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import DataTable from '../components/DataTable.jsx';
import Breakdown from '../components/Breakdown.jsx';
import MissingMonths from '../components/MissingMonths.jsx';
import { breakdown, formatMonth } from '../format.js';
import { paymentColumns } from '../paymentColumns.jsx';

/** Admin view: pick a user, see their payments and missing aidat months. */
export default function MemberPayments() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [status, setStatus] = useState(null);
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/members').then(setMembers).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setStatus(null);
    setPayments(null);
    if (!id) return;
    setError('');
    Promise.all([api.get(`/members/${id}/status`), api.get(`/payments?member_id=${id}`)])
      .then(([s, p]) => {
        setStatus(s);
        setPayments(p);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const columns = useMemo(() => paymentColumns({ showMember: false }), []);
  const member = status?.member;

  return (
    <section>
      <div className="page-head">
        <h2>Kullanıcı Ödemeleri</h2>
      </div>

      <div className="card member-picker">
        <label className="field">
          <span>Kullanıcı</span>
          <select className="input" value={id || ''} onChange={(e) => navigate(e.target.value ? `/uye/${e.target.value}` : '/uye')}>
            <option value="">Seçiniz…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.missing_count ? ` — ${m.missing_count} ay eksik` : ''}
              </option>
            ))}
          </select>
        </label>
        {member && (
          <div className="member-meta">
            <div><span className="muted">Kullanıcı adı</span> {member.username}</div>
            <div><span className="muted">Başlangıç</span> {formatMonth(member.start_month) || '—'}</div>
            <div><span className="muted">Bitiş</span> {formatMonth(member.end_month) || 'Devam ediyor'}</div>
          </div>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}

      {id && (!status || !payments) && !error && <div className="muted">Yükleniyor…</div>}

      {status && payments && (
        <>
          <MissingMonths months={status.missing_months} member={member} />
          <h3 className="section-title">Ödemeler</h3>
          <DataTable
            columns={columns}
            rows={payments}
            defaultSort={{ key: 'created_at', dir: 'desc' }}
            emptyText="Bu kullanıcının ödemesi yok"
            footer={(visible) => <Breakdown title="Listelenen toplam" {...breakdown(visible)} />}
          />
        </>
      )}
    </section>
  );
}
