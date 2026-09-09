import { publicProcedure, router } from './trpc';
import { authRouter } from '../auth/auth.router';
import { workspaceRouter } from '../workspace/workspace.router';
import { taskRouter } from '../task/task.router';
import { auditRouter } from './routers/audit.router';
import { notificationRouter } from './routers/notification.router';

export const appRouter = router({
  health: publicProcedure.query(() => ({
    ok: true as const,
    service: 'enterprise-task-manager',
  })),
  auth: authRouter,
  workspace: workspaceRouter,
  task: taskRouter,
  audit: auditRouter,
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;
