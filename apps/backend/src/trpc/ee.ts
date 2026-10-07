import { EventEmitter } from 'node:events';

export const TASK_UPDATED_EVENT = 'task.updated' as const;
export const NOTIFICATION_CREATED_EVENT = 'notification.created' as const;

export const ee = new EventEmitter();
ee.setMaxListeners(1_000);
