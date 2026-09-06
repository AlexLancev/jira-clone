'use client';

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { WorkspaceRole } from '@repo/shared';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  GitBranch,
  LayoutGrid,
  Loader2,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { Guard, useAuth } from '@/components/Guard';
import { NotificationBell } from '@/components/NotificationBell';
import { renderAuditChange } from '@/lib/renderAuditChange';
import { formatRelativeTime, getInitials } from '@/lib/time';
import { trpc, type RouterOutputs } from '@/utils/trpc';

type AuditItem = RouterOutputs['audit']['list']['items'][number];

const ACTION_FILTERS = [
  { value: '', label: 'All activity' },
  { value: 'TASK_STATUS_CHANGED', label: 'Status changes' },
  { value: 'TASK_CREATED', label: 'Created' },
  { value: 'TASK_SOFT_DELETED', label: 'Archived' },
  { value: 'COMMENT_CREATED', label: 'Comments' },
  { value: 'PROJECT_CREATED', label: 'Projects' },
] as const;

interface AnalyticsPageProps {
  params: { id: string };
}

export default function AnalyticsPage({ params }: AnalyticsPageProps) {
  const workspaceId = params.id;
  const workspaceQuery = trpc.workspace.get.useQuery({ workspaceId });

  return (
    <Guard
      requireWorkspaceRole={WorkspaceRole.MANAGER}
      workspaceRole={workspaceQuery.data?.currentRole ?? null}
      isReady={!workspaceQuery.isLoading}
      deniedFallback={<AccessDenied />}
    >
      <AnalyticsDashboard
        workspaceId={workspaceId}
        workspaceName={workspaceQuery.data?.name ?? 'Workspace'}
        workspaceRole={workspaceQuery.data?.currentRole ?? null}
      />
    </Guard>
  );
}

function AnalyticsDashboard({
  workspaceId,
  workspaceName,
  workspaceRole,
}: {
  workspaceId: string;
  workspaceName: string;
  workspaceRole: WorkspaceRole | null;
}) {
  const { user } = useAuth();
  const [action, setAction] = useState('');
  const summaryQuery = trpc.audit.summary.useQuery({ workspaceId });
  const feedQuery = trpc.audit.list.useInfiniteQuery(
    {
      workspaceId,
      limit: 20,
      ...(action ? { action } : {}),
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    },
  );

  const items = useMemo(
    () => (feedQuery.data?.pages ?? []).flatMap((page) => page.items),
    [feedQuery.data?.pages],
  );

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border border-slate-800 p-1.5 text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <BarChart3 className="h-4 w-4 text-cyan-400" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{workspaceName}</p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Analytics · {workspaceRole ?? 'system access'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/workspaces/${workspaceId}/kanban`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-700 hover:text-white"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </Link>
            <NotificationBell />
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-slate-200">{user?.name}</p>
              <p className="text-[11px] text-slate-500">{user?.systemRole}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-400">Workspace intelligence</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-50">Activity & audit</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Mutation trail for owners, managers, and system operators. Every status change, archive, and
            comment is captured in the audit log.
          </p>
        </div>

        <div className="mb-8 grid gap-3 md:grid-cols-3">
          <MetricCard
            icon={<Activity className="h-4 w-4 text-cyan-300" />}
            label="Total mutations"
            value={summaryQuery.data?.totalMutations.toLocaleString() ?? '—'}
            hint="All recorded workspace events"
            loading={summaryQuery.isLoading}
          />
          <MetricCard
            icon={<Users className="h-4 w-4 text-indigo-300" />}
            label="Top active contributor"
            value={summaryQuery.data?.topContributor?.name ?? 'No activity yet'}
            hint={
              summaryQuery.data?.topContributor
                ? `${summaryQuery.data.topContributor.mutationCount} mutations`
                : 'Waiting for the first mutation'
            }
            loading={summaryQuery.isLoading}
          />
          <MetricCard
            icon={<GitBranch className="h-4 w-4 text-emerald-300" />}
            label="Most modified task"
            value={summaryQuery.data?.mostModifiedTask?.title ?? 'No task history'}
            hint={
              summaryQuery.data?.mostModifiedTask
                ? `${summaryQuery.data.mostModifiedTask.mutationCount} logged changes`
                : 'Tasks appear after the first edit'
            }
            loading={summaryQuery.isLoading}
          />
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Activity feed</h2>
              <p className="text-xs text-slate-500">Chronological audit stream with cursor pagination</p>
            </div>
            <select
              value={action}
              onChange={(event) => setAction(event.target.value)}
              className="h-9 rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs text-slate-200 outline-none focus:border-cyan-500"
            >
              {ACTION_FILTERS.map((filter) => (
                <option key={filter.value || 'all'} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>

          <div className="px-5 py-6">
            {feedQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
              </div>
            ) : items.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">No audit events match this filter.</p>
            ) : (
              <ol className="relative ml-3 border-l border-slate-800">
                {items.map((item) => (
                  <Fragment key={item.id}>
                    <ActivityItem item={item} />
                  </Fragment>
                ))}
              </ol>
            )}

            {feedQuery.hasNextPage ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => void feedQuery.fetchNextPage()}
                  disabled={feedQuery.isFetchingNextPage}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-700 disabled:opacity-50"
                >
                  {feedQuery.isFetchingNextPage ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Load more
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  loading,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  loading: boolean;
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-board">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-lg border border-slate-800 bg-slate-950 p-2">{icon}</span>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-600" /> : null}
      </div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-slate-50">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </article>
  );
}

function ActivityItem({ item }: { item: AuditItem }) {
  const actorName = item.actor?.name ?? 'System';

  return (
    <li className="relative mb-6 ml-6 last:mb-0">
      <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border border-slate-700 bg-slate-950 ring-4 ring-slate-950" />
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[11px] font-semibold text-cyan-300">
          {getInitials(actorName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-slate-100">{actorName}</span>
            <span className="text-xs text-slate-500">{formatRelativeTime(item.createdAt)}</span>
          </div>
          <div className="mt-1 text-sm">{renderAuditChange(item.action, item.metadata)}</div>
          {item.task ? (
            <p className="mt-1 truncate text-xs text-slate-500">
              Task · {item.task.title}
              {item.task.deletedAt ? ' · archived' : ''}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-600">
              {item.entityType} · {item.entityId.slice(0, 8)}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function AccessDenied() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-rose-500/20 bg-slate-900/80 p-8 text-center shadow-2xl shadow-black/40">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10">
          <ShieldAlert className="h-6 w-6 text-rose-400" />
        </div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-rose-300">Restricted module</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-50">Access denied</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Audit analytics are limited to workspace owners, managers, and global operators. Regular members
          cannot inspect mutation history.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-200 hover:border-slate-700"
        >
          Return to workspaces
        </Link>
      </div>
    </div>
  );
}
