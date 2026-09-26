import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import MonthYearSelect from '../components/MonthYearSelect.jsx';
import { METHODS, PAYMENT_TYPES, currentMonth, formatMonth } from '../format.js';

const empty = () => ({
  member_id: '',
  amount: '',
  period: currentMonth(),
  type: 'aidat',
  type_description: '',
  description: '',
  method: '',
});

export default function PaymentForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/members').then((all) => setMembers(all.filter((m) => m.role === 'user'))).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!isEdit) return setForm(empty());
    api
      .get(`/payments/${id}`)
      .then((p) =>
        setForm({
          member_id: String(p.member_id),
          amount: String(p.amount),
          period: p.period,
          type: p.type,
          type_description: p.type_description || '',
          description: p.description || '',
          method: p.method || '',
        }),
      )
      .catch((e) => setError(e.message));
  }, [id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const member = members.find((m) => String(m.id) === form.member_id);
  const outOfRange =
    member && form.period &&
    ((member.start_month && form.period < member.start_month) || (member.end_month && form.period > member.end_month));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved('');
    try {
      if (isEdit) {
        await api.put(`/payments/${id}`, form);
        navigate('/');
      } else {
        await api.post('/payments', form);
        setSaved(`${member?.name} için ${formatMonth(form.period)} ödemesi kaydedildi.`);
        // Keep member/period/type so consecutive entries are quick; clear the rest.
        setForm((f) => ({ ...f, amount: '', description: '', type_description: '' }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="page-head">
        <h2>{isEdit ? 'Ödeme Düzenle' : 'Ödeme Girişi'}</h2>
      </div>
      <form className="card form" onSubmit={submit}>
        <label className="field">
          <span>Kullanıcı *</span>
          <select className="input" value={form.member_id} onChange={set('member_id')} required>
            <option value="">Seçiniz…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.end_month ? ' (pasif)' : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="row">
          <label className="field">
            <span>Miktar (₺) *</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={set('amount')}
              required
            />
          </label>
          <div className="field">
            <span>Ay / Yıl *</span>
            <MonthYearSelect value={form.period} onChange={set('period')} />
          </div>
        </div>
        {outOfRange && (
          <div className="alert warn">
            Seçilen ay, {member.name} için tanımlı başlangıç–bitiş aralığının dışında.
          </div>
        )}

        <div className="row">
          <label className="field">
            <span>Tip *</span>
            <select className="input" value={form.type} onChange={set('type')}>
              {PAYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>Ödeme şekli</span>
            <div className="radio-group">
              <label><input type="radio" name="method" value="" checked={!form.method} onChange={set('method')} /> Belirtilmedi</label>
              {METHODS.map((m) => (
                <label key={m.value}>
                  <input type="radio" name="method" value={m.value} checked={form.method === m.value} onChange={set('method')} />{' '}
                  {m.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {form.type === 'diger' && (
          <label className="field">
            <span>Diğer – ne ödemesi?</span>
            <input className="input" value={form.type_description} onChange={set('type_description')} placeholder="Örn. bağış" />
          </label>
        )}

        <label className="field">
          <span>Açıklama</span>
          <textarea className="input" rows={3} value={form.description} onChange={set('description')} />
        </label>

        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert success">{saved}</div>}

        <div className="form-actions">
          <button type="button" className="btn" onClick={() => navigate('/')}>
            {isEdit ? 'İptal' : 'Ödemelere dön'}
          </button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </div>
      </form>
    </section>
  );
}
