import { type ReactNode, createElement } from 'react';
import { TaskStatus } from '@repo/shared';

const STATUS_BADGE_CLASS: Record<string, string> = {
  [TaskStatus.BACKLOG]: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
  [TaskStatus.TODO]: 'border-slate-500/40 bg-slate-500/10 text-slate-200',
  [TaskStatus.IN_PROGRESS]: 'border-blue-500/40 bg-blue-500/15 text-blue-300',
  [TaskStatus.IN_REVIEW]: 'border-violet-500/40 bg-violet-500/15 text-violet-300',
  [TaskStatus.DONE]: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  [TaskStatus.CANCELLED]: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function StatusBadge({ status }: { status: string }) {
  const className = STATUS_BADGE_CLASS[status] ?? 'border-slate-700 bg-slate-800 text-slate-300';
  return createElement(
    'span',
    {
      className: `inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`,
    },
    status.replaceAll('_', ' '),
  );
}

function UrgentBadge({ children }: { children: ReactNode }) {
  return createElement(
    'span',
    {
      className:
        'inline-flex rounded-md border border-rose-500/50 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300',
    },
    children,
  );
}

function NeutralBadge({ children }: { children: ReactNode }) {
  return createElement(
    'span',
    {
      className:
        'inline-flex rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-300',
    },
    children,
  );
}

export function renderAuditChange(action: string, changes: any): ReactNode {
  const metadata = isRecord(changes) ? changes : {};

  if (action === 'TASK_STATUS_CHANGED') {
    const fromStatus = asString(metadata.fromStatus) ?? 'UNKNOWN';
    const toStatus = asString(metadata.toStatus) ?? 'UNKNOWN';
    return createElement(
      'span',
      { className: 'inline-flex flex-wrap items-center gap-1.5 text-slate-300' },
      'changed status from',
      createElement(StatusBadge, { status: fromStatus }),
      'to',
      createElement(StatusBadge, { status: toStatus }),
    );
  }

  if (action === 'TASK_SOFT_DELETED') {
    return createElement(
      'span',
      { className: 'inline-flex flex-wrap items-center gap-1.5 text-slate-300' },
      createElement(UrgentBadge, { children: 'Archived task' }),
      'was moved to the archive',
    );
  }

  if (action === 'TASK_CREATED' || action === 'TASK_SEEDED') {
    const title = asString(metadata.title);
    const status = asString(metadata.status);
    return createElement(
      'span',
      { className: 'inline-flex flex-wrap items-center gap-1.5 text-slate-300' },
      action === 'TASK_SEEDED' ? 'seeded task' : 'created task',
      title
        ? createElement(
            'span',
            { className: 'font-medium text-slate-100' },
            title,
          )
        : null,
      status ? createElement(StatusBadge, { status }) : null,
    );
  }

  if (action === 'COMMENT_CREATED') {
    return createElement(
      'span',
      { className: 'inline-flex flex-wrap items-center gap-1.5 text-slate-300' },
      'added a',
      createElement(NeutralBadge, { children: 'Comment' }),
    );
  }

  if (action === 'PROJECT_CREATED') {
    const name = asString(metadata.name);
    const key = asString(metadata.key);
    return createElement(
      'span',
      { className: 'inline-flex flex-wrap items-center gap-1.5 text-slate-300' },
      'created project',
      createElement(NeutralBadge, { children: key ?? name ?? 'Project' }),
    );
  }

  if (action === 'WORKSPACE_CREATED' || action === 'WORKSPACE_SEEDED') {
    const name = asString(metadata.name) ?? asString(metadata.slug);
    return createElement(
      'span',
      { className: 'inline-flex flex-wrap items-center gap-1.5 text-slate-300' },
      action === 'WORKSPACE_SEEDED' ? 'seeded workspace' : 'created workspace',
      name ? createElement(NeutralBadge, { children: name }) : null,
    );
  }

  return createElement(
    'span',
    { className: 'text-slate-400' },
    action.replaceAll('_', ' ').toLowerCase(),
  );
}
