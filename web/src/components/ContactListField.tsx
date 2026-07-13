type Props = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  type?: 'text' | 'email' | 'tel';
  placeholder?: (index: number) => string;
  max?: number;
};

/** A "primary + extras" contact list — e.g. primary phone plus reception/
 * personal alternates. Used for both phone and email so a lead can carry
 * more than one of each (backend already supports up to 5 via
 * extraPhones/extraEmails; this is just the first UI wired to it). */
export function ContactListField({ label, values, onChange, type = 'text', placeholder, max = 4 }: Props) {
  function updateAt(index: number, value: string) {
    const next = [...values];
    next[index] = value;
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  return (
    <>
      {values.map((v, i) => (
        <label key={i}>
          {label} {i + 2}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type={type}
              value={v}
              onChange={(e) => updateAt(i, e.target.value)}
              placeholder={placeholder?.(i)}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn-secondary btn-sm" onClick={() => removeAt(i)}>
              Remove
            </button>
          </div>
        </label>
      ))}
      {values.length < max ? (
        <button
          type="button"
          className="btn-secondary btn-sm"
          style={{ marginBottom: 14 }}
          onClick={() => onChange([...values, ''])}
        >
          + Add another {label.toLowerCase()}
        </button>
      ) : null}
    </>
  );
}
