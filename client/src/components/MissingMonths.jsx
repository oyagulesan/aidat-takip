import { MONTHS } from '../format.js';

/** Months with no aidat payment, grouped by year. `months` are 'YYYY-MM-01' strings. */
export default function MissingMonths({ months, member }) {
  if (!member?.start_month) {
    return (
      <div className="card missing">
        <h3>Eksik aidatlar</h3>
        <div className="muted">Başlangıç ayı tanımlı olmadığı için hesaplanamıyor.</div>
      </div>
    );
  }

  const byYear = {};
  for (const m of months) {
    const [y, mm] = m.split('-');
    (byYear[y] ||= []).push(MONTHS[Number(mm) - 1]);
  }

  return (
    <div className={`card missing ${months.length ? 'has-missing' : ''}`}>
      <h3>
        Eksik aidatlar{' '}
        <span className={`badge ${months.length ? 'pending' : 'delivered'}`}>
          {months.length ? `${months.length} ay` : 'Eksik yok'}
        </span>
      </h3>
      {months.length > 0 && (
        <div className="missing-years">
          {Object.entries(byYear).map(([y, names]) => (
            <div key={y} className="missing-year">
              <strong>{y}</strong>
              <div className="chips">
                {names.map((n) => (
                  <span key={n} className="chip">{n}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="muted small">
        Başlangıç ayından {member.end_month ? 'bitiş ayına' : 'bu aya'} kadar, “Aidat” tipinde ödemesi olmayan aylar.
      </div>
    </div>
  );
}
