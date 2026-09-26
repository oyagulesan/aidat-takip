import { MONTHS } from '../format.js';

/**
 * Month + year picker. Value is 'YYYY-MM-01', or '' when allowEmpty and cleared.
 * Two selects instead of <input type="month">, which Safari does not support.
 */
export default function MonthYearSelect({ value, onChange, allowEmpty = false, id }) {
  const now = new Date();
  const [y, m] = value ? value.split('-') : ['', ''];
  const years = [];
  for (let i = now.getFullYear() + 2; i >= now.getFullYear() - 15; i--) years.push(String(i));
  if (y && !years.includes(y)) years.push(y);

  const change = (year, month) => {
    if (!year || !month) return onChange('');
    onChange(`${year}-${month}-01`);
  };
  const defaultYear = String(now.getFullYear());
  const defaultMonth = String(now.getMonth() + 1).padStart(2, '0');

  return (
    <div className="month-year">
      <select id={id} className="input" value={m} onChange={(e) => change(e.target.value && (y || defaultYear), e.target.value)}>
        {allowEmpty && <option value="">—</option>}
        {MONTHS.map((name, i) => {
          const v = String(i + 1).padStart(2, '0');
          return <option key={v} value={v}>{name}</option>;
        })}
      </select>
      <select className="input" value={y} onChange={(e) => change(e.target.value, e.target.value && (m || defaultMonth))}>
        {allowEmpty && <option value="">—</option>}
        {years.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
      </select>
    </div>
  );
}
