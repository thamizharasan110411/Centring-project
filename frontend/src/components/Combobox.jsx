import { useEffect, useRef, useState } from 'react';
import { inputCls } from './FormControls';

export default function Combobox({
  options = [],
  value,
  onChange,
  placeholder = 'Select…',
  getLabel,
  getSub,
  disabled = false,
  error,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  const selected = options.find((o) => String(o.id) === String(value));
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter(
        (o) =>
          getLabel(o).toLowerCase().includes(q) ||
          (getSub ? (getSub(o) || '').toLowerCase().includes(q) : false)
      )
    : options;

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls(error)} flex items-center justify-between gap-2 text-left disabled:bg-slate-100 disabled:text-slate-400`}
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <span className="text-slate-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            className="sticky top-0 w-full border-b border-slate-200 px-3 py-2.5 text-sm outline-none focus:bg-indigo-50/40"
          />
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-slate-400">No matches found</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex w-full flex-col px-3 py-2.5 text-left hover:bg-indigo-50"
                >
                  <span className="text-sm font-medium text-slate-800">{getLabel(o)}</span>
                  {getSub && <span className="text-xs text-slate-500">{getSub(o)}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}