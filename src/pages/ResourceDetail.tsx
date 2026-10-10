import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lightbulb, Trash2, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { useTeam, useTeamMutation, useTeamQuery } from '../lib/session';
import type { Resource } from '../lib/types';
import { RESOURCE_CATEGORY_LABELS, type ResourceCategory } from '../../shared/domain';
import { Badge, Card, ConfirmButton, ErrorNote, Spinner } from '../components/ui';
import { Markdown } from '../components/Markdown';
import { DiagramView } from '../components/Rink';

/** Convert a YouTube / Vimeo URL into an embeddable URL; null if not embeddable. */
function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) return `https://www.youtube-nocookie.com/embed/${u.searchParams.get('v')}`;
    if (u.hostname === 'youtu.be') return `https://www.youtube-nocookie.com/embed${u.pathname}`;
    if (u.hostname.includes('vimeo.com') && /^\/\d+/.test(u.pathname)) return `https://player.vimeo.com/video${u.pathname}`;
  } catch {
    /* not a URL */
  }
  return null;
}

export default function ResourceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = useTeam();
  const { data: r, isLoading, error } = useTeamQuery<Resource>(`/resources/${id}`);
  const del = useTeamMutation((b) => api.del(`${b}/resources/${id}`), { toast: 'Resource deleted', onSuccess: () => navigate('/library') });
  if (isLoading) return <Spinner />;
  if (error || !r) return <ErrorNote error={error} />;
  const embed = r.video_url ? embedUrl(r.video_url) : null;
  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/library" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Coaching Library
      </Link>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{RESOURCE_CATEGORY_LABELS[r.category as ResourceCategory]}</div>
      <h1 className="mt-1 text-4xl font-semibold">{r.title}</h1>
      <p className="mt-2 text-lg text-muted">{r.summary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge>{r.read_minutes} min read</Badge>
        <Badge>{r.level}</Badge>
        {r.team_id ? <Badge tone="accent">Team resource</Badge> : <Badge>BenchIQ library</Badge>}
        {canEdit && r.team_id && (
          <span className="ml-auto">
            <ConfirmButton onConfirm={() => del.mutate(undefined)} confirmText="Delete resource" icon={<Trash2 className="h-4 w-4" />}>
              Delete
            </ConfirmButton>
          </span>
        )}
      </div>
      {r.video_url &&
        (embed ? (
          <div className="mt-6 aspect-video overflow-hidden rounded-xl border border-line">
            <iframe src={embed} title={r.title} className="h-full w-full" allow="encrypted-media; picture-in-picture" allowFullScreen />
          </div>
        ) : (
          <a href={r.video_url} target="_blank" rel="noreferrer noopener" className="link mt-4 inline-flex items-center gap-1 text-sm">
            Watch video <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ))}
      {r.diagram && (
        <div className="card mt-6 p-3">
          <DiagramView diagram={r.diagram} />
        </div>
      )}
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_280px]">
        <article>
          <Markdown text={r.body ?? ''} />
        </article>
        {r.tips && r.tips.length > 0 && (
          <aside>
            <Card title="Coaching tips" icon={<Lightbulb className="h-4 w-4" />}>
              <ul className="space-y-2.5 text-sm">
                {r.tips.map((t) => (
                  <li key={t} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> {t}
                  </li>
                ))}
              </ul>
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}
