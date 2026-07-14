import { useEffect, useRef, useState } from 'react';
import { api, getApiBaseUrl, getStoredToken } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isManager } from '../lib/roles';
import { PageHeader } from '../components/PageHeader';

type Category = 'EXHIBITION_TENDER' | 'BILLBOARD_SIGNBOARD';

const CATEGORY_LABEL: Record<Category, string> = {
  EXHIBITION_TENDER: 'Exhibition / Tender',
  BILLBOARD_SIGNBOARD: 'Billboard / Signboard',
};

type Fields = {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  eventName?: string;
  eventStartDate?: string;
  eventEndDate?: string;
  venue?: string;
  whatFor?: string;
  participationFee?: string;
  pitchNote: string;
};

type OrgUser = { id: string; name: string; role: string };

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function mimeFromFile(file: File): string {
  return file.type || 'image/jpeg';
}

export function PhotoCapturePage() {
  const { user } = useAuth();
  const manager = isManager(user?.role);
  const fileRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<Category | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [fields, setFields] = useState<Fields | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [ownerId, setOwnerId] = useState('');
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [createEvent, setCreateEvent] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ users: OrgUser[] }>('/calendar/org-users')
      .then((d) => setOrgUsers((d.users ?? []).filter((u) => u.role === 'SALES' || u.role === 'MANAGER')))
      .catch(() => setOrgUsers([]));
  }, []);

  useEffect(() => {
    if (!manager && user?.id) setOwnerId(user.id);
  }, [manager, user?.id]);

  function onPickFile(f: File | null) {
    setFile(f);
    setFields(null);
    setBlockReason(null);
    setError('');
    setSuccess('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  async function analyze() {
    if (!file || !category) return;
    setAnalyzing(true);
    setError('');
    try {
      const imageBase64 = await fileToBase64(file);
      const res = await api<{ fields: Fields; duplicate: string | null; pastEvent: string | null }>(
        '/ai/photo-capture',
        { method: 'POST', body: { imageBase64, imageMimeType: mimeFromFile(file), category } },
      );
      setFields(res.fields);
      setBlockReason(res.duplicate ?? res.pastEvent ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not analyze photo');
    } finally {
      setAnalyzing(false);
    }
  }

  function patchFields(partial: Partial<Fields>) {
    setFields((f) => (f ? { ...f, ...partial } : f));
  }

  function toggleAttendee(id: string) {
    setAttendeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function resetAll() {
    setFile(null);
    setFields(null);
    setBlockReason(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCategory(null);
    if (fileRef.current) fileRef.current.value = '';
    setAttendeeIds([]);
    setCreateEvent(true);
  }

  async function createLead() {
    if (!fields || !category) return;
    if (blockReason) {
      setError(blockReason);
      return;
    }
    if (!fields.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!ownerId) {
      setError('Choose who this lead should be assigned to.');
      return;
    }

    const start = fields.eventStartDate ? new Date(`${fields.eventStartDate}T09:00:00`) : null;
    const wantsEvent = category === 'EXHIBITION_TENDER' && createEvent && start !== null;

    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        category,
        name: fields.name.trim(),
        company: fields.company?.trim() || undefined,
        email: fields.email?.trim() || undefined,
        phone: fields.phone?.trim() || undefined,
        address: fields.address?.trim() || undefined,
        source: category === 'EXHIBITION_TENDER' ? 'Exhibition / Tender photo' : 'Billboard / Signboard photo',
        tags: [CATEGORY_LABEL[category]],
        ownerId,
        pitchNote: fields.pitchNote,
      };
      if (wantsEvent && start) {
        const dayEnd = new Date(start);
        dayEnd.setHours(17, 0, 0, 0);
        body.event = {
          title: fields.eventName || fields.company || fields.name,
          startAt: start.toISOString(),
          endAt: dayEnd.toISOString(),
          attendeeIds,
          seriesEndDate: fields.eventEndDate,
        };
      }
      if (file) {
        try {
          body.photo = {
            fileName: file.name || `capture.${mimeFromFile(file).split('/')[1] ?? 'jpg'}`,
            mimeType: mimeFromFile(file),
            dataBase64: await fileToBase64(file),
          };
        } catch {
          // Non-fatal — the lead is still worth creating without the attachment.
        }
      }

      const token = getStoredToken();
      const res = await fetch(`${getApiBaseUrl()}/leads/photo-capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data as { error?: string; message?: string };
        if (err.error === 'DUPLICATE_EVENT' || err.error === 'PAST_EVENT') {
          throw new Error(err.message ?? 'Could not save this capture.');
        }
        throw new Error(err.message ?? err.error ?? 'Could not create lead');
      }
      const parts = [
        data.calendarError ? `calendar event: ${data.calendarError}` : null,
        data.attachmentError ? `original photo: ${data.attachmentError}` : null,
      ].filter(Boolean);
      setSuccess(
        parts.length
          ? `Lead "${fields.name}" saved, but this had an issue — ${parts.join('; ')}.`
          : `Lead "${fields.name}" saved.`,
      );
      resetAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create lead');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-wide">
      <PageHeader
        title="Capture from photo"
        subtitle="Upload a photo of an exhibition flyer, tender notice, billboard, or signboard — AI reads it and drafts a lead."
      />

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <strong style={{ display: 'block', marginBottom: 8 }}>What is this?</strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
              <button
                key={c}
                type="button"
                className={category === c ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                onClick={() => {
                  setCategory(c);
                  setFields(null);
                  setBlockReason(null);
                }}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        {category ? (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Photo
            <input
              ref={fileRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.gif"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </label>
        ) : null}

        {previewUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            <img src={previewUrl} alt="Selected capture" style={{ maxWidth: 360, maxHeight: 260, borderRadius: 8 }} />
            <button type="button" className="btn-primary" disabled={analyzing} onClick={() => void analyze()}>
              {analyzing ? 'Analyzing…' : 'Analyze photo'}
            </button>
          </div>
        ) : null}

        {error ? <p className="error">{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}

        {fields && category ? (
          <div style={{ borderTop: '1px solid rgba(148,163,184,0.22)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: 0 }}>Review before saving</h3>

            {fields.participationFee ? (
              <div
                style={{
                  background: 'rgba(251,191,36,0.12)',
                  border: '1px solid #fbbf24',
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <strong style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#b45309' }}>
                  ⚠️ Participation fee found
                </strong>
                <input
                  value={fields.participationFee}
                  onChange={(e) => patchFields({ participationFee: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
            ) : null}

            <label>
              Name *
              <input value={fields.name} onChange={(e) => patchFields({ name: e.target.value })} />
            </label>
            <label>
              Company
              <input value={fields.company ?? ''} onChange={(e) => patchFields({ company: e.target.value })} />
            </label>
            <label>
              Email
              <input value={fields.email ?? ''} onChange={(e) => patchFields({ email: e.target.value })} />
            </label>
            <label>
              Phone
              <input value={fields.phone ?? ''} onChange={(e) => patchFields({ phone: e.target.value })} />
            </label>
            <label>
              Address
              <input value={fields.address ?? ''} onChange={(e) => patchFields({ address: e.target.value })} />
            </label>

            {category === 'EXHIBITION_TENDER' ? (
              <>
                <label>
                  Event name
                  <input value={fields.eventName ?? ''} onChange={(e) => patchFields({ eventName: e.target.value })} />
                </label>
                <label>
                  Venue
                  <input value={fields.venue ?? ''} onChange={(e) => patchFields({ venue: e.target.value })} />
                </label>
                <div className="muted" style={{ fontSize: 13 }}>
                  Dates (as read from photo): {fields.eventStartDate ?? '—'}
                  {fields.eventEndDate ? ` → ${fields.eventEndDate}` : ''}
                </div>
                {fields.eventStartDate ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <input type="checkbox" checked={createEvent} onChange={(e) => setCreateEvent(e.target.checked)} />
                    Add to calendar
                  </label>
                ) : (
                  <p className="muted" style={{ fontSize: 13 }}>
                    No dates found on the photo — edit the event name/venue then add manually in Calendar if needed.
                  </p>
                )}
              </>
            ) : null}

            <label>
              AI pitch note
              <textarea
                value={fields.pitchNote}
                onChange={(e) => patchFields({ pitchNote: e.target.value })}
                rows={4}
              />
            </label>

            {manager ? (
              <div>
                <strong style={{ display: 'block', marginBottom: 8 }}>Assign to *</strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {orgUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className={ownerId === u.id ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                      onClick={() => setOwnerId(u.id)}
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {category === 'EXHIBITION_TENDER' && createEvent && fields.eventStartDate ? (
              <div>
                <strong style={{ display: 'block', marginBottom: 8 }}>Also invite to calendar event</strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {orgUsers
                    .filter((u) => u.id !== ownerId)
                    .map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className={attendeeIds.includes(u.id) ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                        onClick={() => toggleAttendee(u.id)}
                      >
                        {u.name}
                      </button>
                    ))}
                </div>
              </div>
            ) : null}

            {blockReason ? (
              <div
                style={{
                  background: 'rgba(248,113,113,0.12)',
                  border: '1px solid #f87171',
                  borderRadius: 8,
                  padding: 10,
                  color: '#b91c1c',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                🚫 {blockReason}
              </div>
            ) : null}

            <button
              type="button"
              className="btn-primary"
              disabled={saving || Boolean(blockReason)}
              onClick={() => void createLead()}
              style={{ alignSelf: 'flex-start' }}
            >
              {saving ? 'Saving…' : 'Create lead'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
