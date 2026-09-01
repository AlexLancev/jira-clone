'use client';

import { TaskPriority, type TaskStatus } from '@repo/shared';
import { GripVertical } from 'lucide-react';
import type { TaskRecord } from '@/utils/trpc';
import { PRIORITY_STYLES } from '@/lib/ui';

interface TaskCardProps {
  task: TaskRecord;
  onDragStart: (taskId: string, fromStatus: TaskStatus) => void;
}

export function TaskCard({ task, onDragStart }: TaskCardProps) {
  return (
    <article
      draggable
      onDragStart={() => onDragStart(task.id, task.status as TaskStatus)}
      className="group cursor-grab rounded-lg border border-slate-800/80 bg-slate-950/70 p-2.5 shadow-board transition hover:border-slate-700 hover:bg-slate-900 active:cursor-grabbing"
    >
      <div className="mb-1.5 flex items-start gap-1.5">
        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-slate-400" />
        <h3 className="line-clamp-2 text-[13px] font-medium leading-4 text-slate-100">{task.title}</h3>
      </div>
      {task.description ? (
        <p className="mb-2 line-clamp-2 pl-5 text-[11px] leading-4 text-slate-500">{task.description}</p>
      ) : null}
      <div className="flex items-center justify-between pl-5">
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            PRIORITY_STYLES[task.priority as TaskPriority]
          }`}
        >
          {task.priority}
        </span>
        {task.estimatePoints !== null && task.estimatePoints !== undefined ? (
          <span className="text-[10px] tabular-nums text-slate-500">{task.estimatePoints} pts</span>
        ) : null}
      </div>
    </article>
  );
}
