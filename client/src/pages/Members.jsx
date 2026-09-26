import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import DataTable from '../components/DataTable.jsx';
import MonthYearSelect from '../components/MonthYearSelect.jsx';
import { currentMonth, formatMonth } from '../format.js';

const blank = () => ({ id: null, name: '', username: '', password: '', role: 'user', start_month: currentMonth(), end_month: '' });

const isActive = (m) => !m.end_month || m.end_month >= currentMonth();

const columns = [
  { key: 'name', label: 'İsim' },
  { key: 'username', label: 'Kullanıcı adı' },
  { key: 'role', label: 'Rol', text: (m) => (m.role === 'admin' ? 'Admin' : 'Kullanıcı') },
  { key: 'start_month', label: 'Başlangıç', text: (m) => formatMonth(m.start_month) },
  { key: 'end_month', label: 'Bitiş', text: (m) => formatMonth(m.end_month) },
  {
    key: 'status',
    label: 'Durum',
    value: (m) => (isActive(m) ? 'Aktif' : 'Pasif'),
    render: (m) => <span className={`badge ${isActive(m) ? 'delivered' : 'pending'}`}>{isActive(m) ? 'Aktif' : 'Pasif'}</span>,
  },
  {
    key: 'missing_count',
    label: 'Eksik aidat',
    align: 'right',
    text: (m) => (m.start_month ? `${m.missing_count} ay` : '—'),
    render: (m) =>
      !m.start_month ? '—' : m.missing_count ? <span className="badge pending">{m.missing_count} ay</span> : <span className="badge delivered">Yok</span>,
  },
];

export default function Members() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null); // null = form closed
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/members').then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const edit = (m) => {
    setError('');
    setForm({ ...m, password: '', start_month: m.start_month || '', end_month: m.end_month || '' });
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (form.id) await api.put(`/members/${form.id}`, form);
      else await api.post('/members', form);
      setForm(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m) => {
    if (!confirm(`${m.name} silinsin mi?`)) return;
    try {
      await api.del(`/members/${m.id}`);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <section>
      <div className="page-head">
        <h2>Kullanıcılar</h2>
        <button className="btn btn-primary" onClick={() => { setError(''); setForm(blank()); }}>+ Yeni kullanıcı</button>
      </div>

      {form && (
        <form className="card form" onSubmit={save}>
          <h3>{form.id ? `${form.name} – düzenle` : 'Yeni kullanıcı'}</h3>
          <div className="row">
            <label className="field">
              <span>İsim *</span>
              <input className="input" value={form.name} onChange={set('name')} required autoFocus />
            </label>
            <label className="field">
              <span>Kullanıcı adı *</span>
              <input className="input" value={form.username} onChange={set('username')} required autoComplete="off" />
            </label>
          </div>
          <div className="row">
            <label className="field">
              <span>{form.id ? 'Yeni şifre (boş bırakılırsa değişmez)' : 'Şifre *'}</span>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={set('password')}
                required={!form.id}
                minLength={4}
                autoComplete="new-password"
              />
            </label>
            <label className="field">
              <span>Rol</span>
              <select className="input" value={form.role} onChange={set('role')} disabled={form.id === user.id}>
                <option value="user">Kullanıcı</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>
          <div className="row">
            <div className="field">
              <span>Başlangıç ayı {form.role === 'user' && '*'}</span>
              <MonthYearSelect value={form.start_month} onChange={set('start_month')} allowEmpty={form.role === 'admin'} />
            </div>
            <div className="field">
              <span>Bitiş ayı (boş = devam ediyor)</span>
              <MonthYearSelect value={form.end_month} onChange={set('end_month')} allowEmpty />
            </div>
          </div>
          {error && <div className="alert error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setForm(null)}>İptal</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
          </div>
        </form>
      )}

      {!form && error && <div className="alert error">{error}</div>}
      {!rows ? (
        <div className="muted">Yükleniyor…</div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          defaultSort={{ key: 'name', dir: 'asc' }}
          actions={(m) => (
            <>
              <button className="btn btn-small" onClick={() => navigate(`/uye/${m.id}`)}>Ödemeler</button>
              <button className="btn btn-small" onClick={() => edit(m)}>Düzenle</button>
              {m.id !== user.id && (
                <button className="btn btn-small btn-danger" onClick={() => remove(m)}>Sil</button>
              )}
            </>
          )}
        />
      )}
    </section>
  );
}
