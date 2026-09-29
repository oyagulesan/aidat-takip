import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatMoney } from '../format.js';

const WARN = 'delivery.warn_threshold';
const DANGER = 'delivery.danger_threshold';

export default function Settings() {
  const [config, setConfig] = useState(null); // server response: { values, defaults, isDefault }
  const [form, setForm] = useState({ [WARN]: '', [DANGER]: '' });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = (c) => {
    setConfig(c);
    setForm({ [WARN]: String(c.values[WARN]), [DANGER]: String(c.values[DANGER]) });
  };

  useEffect(() => {
    api.get('/config').then(apply).catch((e) => setError(e.message));
  }, []);

  const save = async (values, message) => {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      apply(await api.put('/config', { values }));
      setSaved(message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const warn = Number(form[WARN]);
    const danger = Number(form[DANGER]);
    if (!(warn > 0) || !(danger > 0)) return setError("Eşik değerleri 0'dan büyük bir sayı olmalıdır");
    if (warn >= danger) return setError('Sarı eşik, kırmızı eşikten küçük olmalıdır');
    save({ [WARN]: warn, [DANGER]: danger }, 'Eşik değerleri kaydedildi.');
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const warn = Number(form[WARN]) || 0;
  const danger = Number(form[DANGER]) || 0;

  const field = (key, label) => (
    <label className="field">
      <span>{label}</span>
      <input className="input" type="number" min="1" step="1" inputMode="numeric" value={form[key]} onChange={set(key)} required />
      <span className="muted small">
        Varsayılan: {formatMoney(config.defaults[key])}
        {config.isDefault[key] ? ' (şu an varsayılan kullanılıyor)' : ''}
      </span>
    </label>
  );

  return (
    <section>
      <div className="page-head">
        <h2>Ayarlar</h2>
      </div>
      {!config ? (
        error ? <div className="alert error">{error}</div> : <div className="muted">Yükleniyor…</div>
      ) : (
        <form className="card form narrow-wide" onSubmit={submit}>
          <h3>Teslimat uyarı eşikleri</h3>
          <p className="muted small" style={{ margin: 0 }}>
            Ödemeler ekranındaki “Teslim edilmemiş toplam” göstergesinin rengini belirler.
          </p>
          <div className="row">
            {field(WARN, 'Sarı eşik (₺)')}
            {field(DANGER, 'Kırmızı eşik (₺)')}
          </div>

          <div className="threshold-preview">
            <span><i className="dot dot-ok" /> {formatMoney(warn)} altı: Teslimat için erken</span>
            <span><i className="dot dot-warn" /> {formatMoney(warn)} – {formatMoney(danger)}: Teslimat yaklaşıyor</span>
            <span><i className="dot dot-danger" /> {formatMoney(danger)} üstü: Teslimat zamanı</span>
          </div>

          {error && <div className="alert error">{error}</div>}
          {saved && <div className="alert success">{saved}</div>}

          <div className="form-actions">
            <button
              type="button"
              className="btn"
              disabled={busy || (config.isDefault[WARN] && config.isDefault[DANGER])}
              onClick={() => save({ [WARN]: null, [DANGER]: null }, 'Varsayılan değerlere dönüldü.')}
            >
              Varsayılana dön
            </button>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
          </div>
        </form>
      )}
    </section>
  );
}
