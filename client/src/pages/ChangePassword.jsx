import { useState } from 'react';
import { api } from '../api.js';

export default function ChangePassword() {
  const [form, setForm] = useState({ current: '', next: '', repeat: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setDone(false);
    if (form.next !== form.repeat) return setError('Yeni şifreler eşleşmiyor');
    setBusy(true);
    try {
      await api.post('/auth/password', { current_password: form.current, new_password: form.next });
      setDone(true);
      setForm({ current: '', next: '', repeat: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="page-head">
        <h2>Şifre Değiştir</h2>
      </div>
      <form className="card form narrow" onSubmit={submit}>
        <label className="field">
          <span>Mevcut şifre</span>
          <input className="input" type="password" value={form.current} onChange={set('current')} required autoComplete="current-password" autoFocus />
        </label>
        <label className="field">
          <span>Yeni şifre</span>
          <input className="input" type="password" value={form.next} onChange={set('next')} required minLength={4} autoComplete="new-password" />
        </label>
        <label className="field">
          <span>Yeni şifre (tekrar)</span>
          <input className="input" type="password" value={form.repeat} onChange={set('repeat')} required minLength={4} autoComplete="new-password" />
        </label>
        {error && <div className="alert error">{error}</div>}
        {done && <div className="alert success">Şifreniz değiştirildi.</div>}
        <div className="form-actions">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Şifreyi değiştir'}</button>
        </div>
      </form>
    </section>
  );
}
