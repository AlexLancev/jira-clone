'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  TaskPriority,
  TaskStatus,
  WorkspaceRole,
  canTransitionTaskStatus,
} from '@repo/shared';
import { ArrowLeft, CirclePlus, LayoutGrid } from 'lucide-react';
import { canPassGuard, Guard, useAuth } from '@/components/Guard';
import { NotificationBell } from '@/components/NotificationBell';
import { TaskCard } from '@/components/TaskCard';
import { useToast } from '@/components/Toast';
import { STATUS_COLUMNS } from '@/lib/ui';
import { getTrpcErrorMessage, trpc, type TaskRecord } from '@/utils/trpc';

interface KanbanPageProps {
  params: { id: string };
}

export default function KanbanPage({ params }: KanbanPageProps) {
  const workspaceId = params.id;
  const workspaceQuery = trpc.workspace.get.useQuery({ workspaceId });

  return (
    <Guard
      requireWorkspaceRole={WorkspaceRole.MEMBER}
      workspaceRole={workspaceQuery.data?.currentRole ?? null}
      isReady={!workspaceQuery.isLoading}
    >
      <KanbanBoard
        workspaceId={workspaceId}
        workspaceName={workspaceQuery.data?.name ?? 'Workspace'}
        workspaceRole={workspaceQuery.data?.currentRole ?? null}
      />
    </Guard>
  );
}

function KanbanBoard({
  workspaceId,
  workspaceName,
  workspaceRole,
}: {
  workspaceId: string;
  workspaceName: string;
  workspaceRole: WorkspaceRole | null;
}) {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const utils = trpc.useUtils();
  const listInput = { workspaceId };
  const tasksQuery = trpc.task.list.useQuery(listInput);
  const [draftTitle, setDraftTitle] = useState('');
  const [activeColumn, setActiveColumn] = useState<TaskStatus | null>(null);
  const dragRef = useRef<{ taskId: string; fromStatus: TaskStatus } | null>(null);

  trpc.task.onStatusChange.useSubscription(
    { workspaceId },
    {
      onData: () => {
        void utils.task.list.invalidate();
      },
    },
  );

  const createTask = trpc.task.create.useMutation({
    onSuccess: async () => {
      setDraftTitle('');
      await utils.task.list.invalidate(listInput);
      pushToast({ variant: 'success', title: 'Task created' });
    },
    onError: (error) => {
      pushToast({
        variant: 'error',
        title: 'Could not create task',
        description: getTrpcErrorMessage(error),
      });
    },
  });

  const updateStatus = trpc.task.updateStatus.useMutation({
    onMutate: async ({ taskId, toStatus }) => {
      await utils.task.list.cancel(listInput);
      const previous = utils.task.list.getData(listInput);

      utils.task.list.setData(listInput, (current) =>
        (current ?? []).map((task) =>
          task.id === taskId ? { ...task, status: toStatus } : task,
        ),
      );

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        utils.task.list.setData(listInput, context.previous);
      }

      const illegal = !canTransitionTaskStatus(variables.fromStatus, variables.toStatus);
      pushToast({
        variant: 'error',
        title: illegal ? 'Illegal transition' : 'Move reverted',
        description: getTrpcErrorMessage(error),
      });
    },
    onSettled: async () => {
      await utils.task.list.invalidate(listInput);
    },
  });

  const grouped = useMemo(() => {
    const tasks = tasksQuery.data ?? [];
    return STATUS_COLUMNS.map((column) => ({
      ...column,
      tasks: tasks.filter((task) => task.status === column.status),
    }));
  }, [tasksQuery.data]);

  function handleDragStart(taskId: string, fromStatus: TaskStatus) {
    dragRef.current = { taskId, fromStatus };
  }

  function handleDrop(toStatus: TaskStatus) {
    const drag = dragRef.current;
    dragRef.current = null;
    setActiveColumn(null);
    if (!drag || drag.fromStatus === toStatus) {
      return;
    }

    updateStatus.mutate({
      taskId: drag.taskId,
      fromStatus: drag.fromStatus,
      toStatus,
    });
  }

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    const title = draftTitle.trim();
    if (!title) {
      return;
    }
    createTask.mutate({
      workspaceId,
      title,
      status: TaskStatus.BACKLOG,
      priority: TaskPriority.MEDIUM,
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border border-slate-800 p-1.5 text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <LayoutGrid className="h-4 w-4 text-cyan-400" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{workspaceName}</p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Kanban · {workspaceRole ?? 'system access'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canPassGuard({
              user,
              requireWorkspaceRole: WorkspaceRole.MANAGER,
              workspaceRole,
            }) ? (
              <Link
                href={`/workspaces/${workspaceId}/analytics`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-700 hover:text-white"
              >
                Analytics
              </Link>
            ) : null}
            <NotificationBell />
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-slate-200">{user?.name}</p>
              <p className="text-[11px] text-slate-500">{user?.systemRole}</p>
            </div>
          </div>
        </div>
      </header>

      <form
        onSubmit={handleCreate}
        className="flex items-center gap-2 border-b border-slate-800/80 bg-slate-900/40 px-4 py-2.5"
      >
        <CirclePlus className="h-4 w-4 text-slate-500" />
        <input
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          placeholder="Quick add to Backlog"
          className="h-9 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
        />
        <button
          type="submit"
          disabled={createTask.isPending || draftTitle.trim().length === 0}
          className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-40"
        >
          Add task
        </button>
      </form>

      <div className="flex flex-1 gap-3 overflow-x-auto p-4">
        {grouped.map((column) => (
          <KanbanColumn
            key={column.status}
            label={column.label}
            hint={column.hint}
            accent={column.accent}
            status={column.status}
            tasks={column.tasks}
            isActive={activeColumn === column.status}
            isLoading={tasksQuery.isLoading}
            onDragStart={handleDragStart}
            onDragEnter={() => setActiveColumn(column.status)}
            onDragLeave={() => setActiveColumn((current) => (current === column.status ? null : current))}
            onDrop={() => handleDrop(column.status)}
          />
        ))}
      </div>
    </div>
  );
}

function KanbanColumn({
  label,
  hint,
  accent,
  status,
  tasks,
  isActive,
  isLoading,
  onDragStart,
  onDragEnter,
  onDragLeave,
  onDrop,
}: {
  label: string;
  hint: string;
  accent: string;
  status: TaskStatus;
  tasks: TaskRecord[];
  isActive: boolean;
  isLoading: boolean;
  onDragStart: (taskId: string, fromStatus: TaskStatus) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
}) {
  return (
    <section
      onDragOver={(event) => {
        event.preventDefault();
        onDragEnter();
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragEnter();
      }}
      onDragLeave={onDragLeave}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className={`flex h-[calc(100vh-9.5rem)] w-[272px] shrink-0 flex-col rounded-xl border bg-slate-900/80 ${
        isActive ? 'border-cyan-400/50 ring-1 ring-cyan-400/30' : 'border-slate-800'
      }`}
    >
      <header className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${accent}`} />
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">{label}</h2>
        </div>
        <span className="rounded-md bg-slate-950 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-400">
          {tasks.length}
        </span>
      </header>
      <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.16em] text-slate-600">{hint}</p>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={`${status}-skeleton-${index}`} className="h-16 animate-pulse rounded-lg bg-slate-950/80" />
          ))
        ) : tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-800 px-3 py-6 text-center text-[11px] text-slate-600">
            Drop tasks here
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} onDragStart={onDragStart} />)
        )}
      </div>
    </section>
  );
}
