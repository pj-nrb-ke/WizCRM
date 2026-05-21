import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type TeamRow = {
  id: string;
  name: string;
  memberCount: number;
  members: { id: string; name: string; email: string; role: string }[];
};

export function TeamsPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ teams: TeamRow[] }>('/admin/teams')
      .then((d) => setTeams(d.teams))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, []);

  return (
    <>
      <h1>Teams</h1>
      <p className="muted">View teams and members. Create/edit teams in the mobile app (Manager tab) for now.</p>
      {error ? <p className="error">{error}</p> : null}
      {teams.map((t) => (
        <div key={t.id} className="card">
          <h2>
            {t.name} <span className="muted">({t.memberCount} members)</span>
          </h2>
          {t.members.length === 0 ? (
            <p className="muted">No members assigned.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {t.members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.email}</td>
                    <td>{m.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </>
  );
}
