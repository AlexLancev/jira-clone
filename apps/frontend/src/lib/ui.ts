import { TaskPriority, TaskStatus } from '@repo/shared';

export const STATUS_COLUMNS: Array<{
  status: TaskStatus;
  label: string;
  hint: string;
  accent: string;
}> = [
  { status: TaskStatus.BACKLOG, label: 'Backlog', hint: 'Unscheduled', accent: 'bg-slate-400' },
  { status: TaskStatus.TODO, label: 'Todo', hint: 'Ready', accent: 'bg-sky-400' },
  { status: TaskStatus.IN_PROGRESS, label: 'In Progress', hint: 'Active', accent: 'bg-indigo-400' },
  { status: TaskStatus.IN_REVIEW, label: 'In Review', hint: 'QA', accent: 'bg-violet-400' },
  { status: TaskStatus.DONE, label: 'Done', hint: 'Shipped', accent: 'bg-emerald-400' },
  { status: TaskStatus.CANCELLED, label: 'Cancelled', hint: 'Dropped', accent: 'bg-rose-400' },
];

export const PRIORITY_STYLES: Record<TaskPriority, string> = {
  [TaskPriority.URGENT]: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  [TaskPriority.HIGH]: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
  [TaskPriority.MEDIUM]: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  [TaskPriority.LOW]: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  [TaskPriority.LOWEST]: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
};

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
