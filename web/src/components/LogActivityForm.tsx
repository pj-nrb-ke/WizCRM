import { useState } from 'react';

const ACTIVITY_TYPES = [
  { value: 'CALL', label: 'Call' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'NOTE', label: 'Note' },
] as const;

type Props = {
  leadId: string;
  saving: boolean;
  onSubmit: (data: { type: string; subject?: string; body: string }) => void;
};

export function LogActivityForm({ saving, onSubmit }: Props) {
  const [type, setType] = useState<string>('NOTE');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    onSubmit({
      type,
      subject: subject.trim() || undefined,
      body: body.trim(),
    });
    setBody('');
    setSubject('');
  }

  return (
    <form className="log-activity-form" onSubmit={handleSubmit}>
      <div className="log-activity-row">
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Subject
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Optional headline"
          />
        </label>
      </div>
      <label>
        Details *
        <textarea
          rows={3}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            type === 'EMAIL'
              ? 'Summary of the email exchange…'
              : type === 'MEETING'
                ? 'Who attended, outcomes, next steps…'
                : 'What happened?'
          }
        />
      </label>
      <button type="submit" className="btn-primary btn-sm" disabled={saving || !body.trim()}>
        {saving ? 'Logging…' : 'Log activity'}
      </button>
    </form>
  );
}
