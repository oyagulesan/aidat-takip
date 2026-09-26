import { useEffect, useMemo, useRef, useState } from 'react';

const EMPTY = '(Boş)';
const collator = new Intl.Collator('tr', { numeric: true, sensitivity: 'base' });

function compare(a, b) {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/**
 * Generic table with Excel-like per-column sort and multi-select value filters.
 *
 * columns: [{
 *   key, label,
 *   value: row => comparable value (used for sorting),
 *   text:  row => string shown in the filter list (defaults to String(value)),
 *   render: row => cell content (defaults to text),
 *   align: 'right' | undefined,
 *   filterable / sortable: default true,
 * }]
 */
export default function DataTable({
  columns,
  rows,
  rowKey = 'id',
  defaultSort,
  selectable = false,
  selected,
  onSelectedChange,
  actions,
  footer,
  emptyText = 'Kayıt yok',
}) {
  const [sort, setSort] = useState(defaultSort || null);
  const [filters, setFilters] = useState({}); // key -> Set of allowed texts
  const [open, setOpen] = useState(null); // { key, rect } of the column whose filter popover is open

  const cols = useMemo(
    () =>
      columns.map((c) => {
        const value = c.value || ((r) => r[c.key]);
        const text = c.text || ((r) => {
          const v = value(r);
          return v === null || v === undefined ? '' : String(v);
        });
        return { filterable: true, sortable: true, ...c, value, text, render: c.render || text };
      }),
    [columns],
  );

  const textOf = (col, row) => col.text(row) || EMPTY;

  const passes = (row, exceptKey) =>
    cols.every((c) => c.key === exceptKey || !filters[c.key] || filters[c.key].has(textOf(c, row)));

  const visibleRows = useMemo(() => {
    const out = rows.filter((r) => passes(r));
    if (sort) {
      const col = cols.find((c) => c.key === sort.key);
      if (col) {
        const dir = sort.dir === 'asc' ? 1 : -1;
        out.sort((a, b) => dir * compare(col.value(a), col.value(b)));
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filters, sort, cols]);

  const activeFilterCount = Object.keys(filters).length;

  /* ---------- selection ---------- */
  const visibleKeys = visibleRows.map((r) => r[rowKey]);
  const allVisibleSelected = selectable && visibleKeys.length > 0 && visibleKeys.every((k) => selected.has(k));
  const someVisibleSelected = selectable && visibleKeys.some((k) => selected.has(k));

  const toggleRow = (k) => {
    const next = new Set(selected);
    next.has(k) ? next.delete(k) : next.add(k);
    onSelectedChange(next);
  };
  const toggleAllVisible = () => {
    const next = new Set(selected);
    if (allVisibleSelected) visibleKeys.forEach((k) => next.delete(k));
    else visibleKeys.forEach((k) => next.add(k));
    onSelectedChange(next);
  };

  const applyFilter = (key, allowed) => {
    setFilters((f) => {
      const next = { ...f };
      if (allowed) next[key] = allowed;
      else delete next[key];
      return next;
    });
  };

  const colCount = cols.length + (selectable ? 1 : 0) + (actions ? 1 : 0);

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        <span className="muted">
          {visibleRows.length} / {rows.length} kayıt
        </span>
        {activeFilterCount > 0 && (
          <button className="btn btn-link" onClick={() => setFilters({})}>
            Filtreleri temizle ({activeFilterCount})
          </button>
        )}
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {selectable && (
                <th className="col-check">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => el && (el.indeterminate = !allVisibleSelected && someVisibleSelected)}
                    onChange={toggleAllVisible}
                    title="Görünenlerin tümünü seç"
                  />
                </th>
              )}
              {cols.map((c) => (
                <th key={c.key} className={c.align === 'right' ? 'right' : ''}>
                  <div className="th-inner">
                    <button
                      className="th-label"
                      disabled={!c.sortable}
                      onClick={() =>
                        setSort((s) =>
                          s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'asc' },
                        )
                      }
                    >
                      {c.label}
                      {sort?.key === c.key && <span className="sort-ind">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                    {c.filterable && (
                      <button
                        className={`filter-btn ${filters[c.key] ? 'active' : ''}`}
                        onClick={(e) =>
                          setOpen(open?.key === c.key ? null : { key: c.key, rect: e.currentTarget.getBoundingClientRect() })
                        }
                        title="Filtrele / sırala"
                      >
                        ▾
                      </button>
                    )}
                  </div>
                  {open?.key === c.key && (
                    <FilterPopover
                      anchor={open.rect}
                      options={distinctOptions(c, rows.filter((r) => passes(r, c.key)), textOf)}
                      current={filters[c.key]}
                      onSort={(dir) => {
                        setSort({ key: c.key, dir });
                        setOpen(null);
                      }}
                      onApply={(allowed) => {
                        applyFilter(c.key, allowed);
                        setOpen(null);
                      }}
                      onClose={() => setOpen(null)}
                    />
                  )}
                </th>
              ))}
              {actions && <th />}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="empty">
                  {rows.length === 0 ? emptyText : 'Filtreye uyan kayıt yok'}
                </td>
              </tr>
            )}
            {visibleRows.map((r) => {
              const k = r[rowKey];
              const isSel = selectable && selected.has(k);
              return (
                <tr
                  key={k}
                  className={isSel ? 'selected' : selectable ? 'clickable' : ''}
                  onClick={selectable ? () => toggleRow(k) : undefined}
                >
                  {selectable && (
                    <td className="col-check">
                      <input type="checkbox" checked={isSel} onChange={() => toggleRow(k)} onClick={(e) => e.stopPropagation()} />
                    </td>
                  )}
                  {cols.map((c) => (
                    <td key={c.key} className={c.align === 'right' ? 'right' : ''}>
                      {c.render(r)}
                    </td>
                  ))}
                  {actions && (
                    <td className="actions" onClick={(e) => e.stopPropagation()}>
                      {actions(r)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          {footer && visibleRows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={colCount}>{footer(visibleRows)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/** Distinct filter texts for a column, ordered by the column's sort value. */
function distinctOptions(col, rows, textOf) {
  const map = new Map();
  for (const r of rows) {
    const t = textOf(col, r);
    if (!map.has(t)) map.set(t, t === EMPTY ? null : col.value(r));
  }
  return [...map.entries()].sort((a, b) => compare(a[1], b[1])).map(([t]) => t);
}

const POP_WIDTH = 260;

function FilterPopover({ options, current, onSort, onApply, onClose, anchor }) {
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(() => new Set(current ? options.filter((o) => current.has(o)) : options));
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onClose);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onClose);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const q = search.trim().toLocaleLowerCase('tr');
  const shown = q ? options.filter((o) => o.toLocaleLowerCase('tr').includes(q)) : options;
  const allShownChecked = shown.length > 0 && shown.every((o) => draft.has(o));

  const toggle = (o) => {
    const next = new Set(draft);
    next.has(o) ? next.delete(o) : next.add(o);
    setDraft(next);
  };
  const toggleAllShown = () => {
    const next = new Set(draft);
    shown.forEach((o) => (allShownChecked ? next.delete(o) : next.add(o)));
    setDraft(next);
  };

  const apply = () => {
    // When searching, Excel keeps only the matching checked items.
    const chosen = q ? new Set(shown.filter((o) => draft.has(o))) : draft;
    const isAll = options.every((o) => chosen.has(o));
    onApply(isAll ? null : chosen);
  };

  return (
    <div
      className="filter-pop"
      ref={ref}
      style={{
        top: anchor.bottom + 4,
        left: Math.max(8, Math.min(anchor.right - POP_WIDTH, window.innerWidth - POP_WIDTH - 8)),
        width: POP_WIDTH,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button className="pop-item" onClick={() => onSort('asc')}>▲ Artan sırala (A→Z)</button>
      <button className="pop-item" onClick={() => onSort('desc')}>▼ Azalan sırala (Z→A)</button>
      <hr />
      <input
        className="input"
        placeholder="Ara…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && apply()}
        autoFocus
      />
      <div className="pop-list">
        <label className="pop-option all">
          <input type="checkbox" checked={allShownChecked} onChange={toggleAllShown} />
          (Tümünü seç)
        </label>
        {shown.map((o) => (
          <label key={o} className="pop-option">
            <input type="checkbox" checked={draft.has(o)} onChange={() => toggle(o)} />
            {o}
          </label>
        ))}
        {shown.length === 0 && <div className="muted small pad">Eşleşme yok</div>}
      </div>
      <div className="pop-actions">
        <button className="btn btn-link" onClick={() => onApply(null)}>Temizle</button>
        <span className="spacer" />
        <button className="btn" onClick={onClose}>İptal</button>
        <button className="btn btn-primary" onClick={apply} disabled={!q && draft.size === 0}>Tamam</button>
      </div>
    </div>
  );
}
