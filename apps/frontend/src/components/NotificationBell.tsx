'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { formatRelativeTime } from '@/lib/time';
import { useToast } from '@/components/Toast';
import { trpc, type RouterOutputs } from '@/utils/trpc';

type NotificationItem = RouterOutputs['notification']['listUnread'][number];

export function NotificationBell() {
  const utils = trpc.useUtils();
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const unreadQuery = trpc.notification.listUnread.useQuery();

  trpc.notification.onNew.useSubscription(undefined, {
    onData: (notification) => {
      void utils.notification.listUnread.invalidate();
      pushToast({
        variant: 'info',
        title: notification.title,
        description: notification.message,
      });

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, { body: notification.message });
      }
    },
  });

  const markAsRead = trpc.notification.markAsRead.useMutation({
    onMutate: async ({ notificationId }) => {
      await utils.notification.listUnread.cancel();
      const previous = utils.notification.listUnread.getData();
      utils.notification.listUnread.setData(undefined, (current) =>
        (current ?? []).filter((item) => item.id !== notificationId),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        utils.notification.listUnread.setData(undefined, context.previous);
      }
    },
    onSettled: async () => {
      await utils.notification.listUnread.invalidate();
    },
  });

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const items = unreadQuery.data ?? [];
  const unreadCount = items.length;
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt)),
    [items],
  );

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }

  function handleItemClick(item: NotificationItem) {
    markAsRead.mutate({ notificationId: item.id });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-300 transition hover:border-slate-700 hover:text-white"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500/70" />
            <span className="relative inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
              {badgeLabel}
            </span>
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/50">
          <div className="border-b border-slate-800 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Notifications</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {unreadCount === 0 ? 'You are all caught up' : `${unreadCount} unread`}
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {sortedItems.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-slate-500">No unread notifications</p>
            ) : (
              sortedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className="block w-full border-b border-slate-800/80 px-3 py-2.5 text-left last:border-b-0 hover:bg-slate-800/60"
                >
                  <p className="text-sm font-medium text-slate-100">{item.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-400">{item.message}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-600">
                    {formatRelativeTime(item.createdAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
