import { useState } from 'react';

type Props = {
  tags: string[];
  suggestions?: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
};

export function LeadTagsEditor({ tags, suggestions = [], onChange, disabled }: Props) {
  const [draft, setDraft] = useState('');

  function addTag(raw: string) {
    const t = raw.trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (tags.some((x) => x.toLowerCase() === key)) return;
    if (tags.length >= 20) return;
    onChange([...tags, t]);
    setDraft('');
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  const unusedSuggestions = suggestions.filter(
    (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="lead-tags-editor">
      <div className="tag-chips">
        {tags.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
            {!disabled ? (
              <button type="button" className="tag-chip-remove" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                ×
              </button>
            ) : null}
          </span>
        ))}
        {tags.length === 0 ? <span className="muted">No tags</span> : null}
      </div>
      {!disabled ? (
        <>
          <div className="tag-add-row">
            <input
              type="text"
              placeholder="Add tag…"
              value={draft}
              maxLength={40}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag(draft);
                }
              }}
            />
            <button type="button" className="btn-secondary btn-sm" onClick={() => addTag(draft)}>
              Add
            </button>
          </div>
          {unusedSuggestions.length > 0 ? (
            <div className="tag-suggestions">
              {unusedSuggestions.slice(0, 12).map((s) => (
                <button key={s} type="button" className="tag-suggestion" onClick={() => addTag(s)}>
                  + {s}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
