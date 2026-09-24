import { z } from 'zod';
import { TaskPriority, TaskStatus } from './enums';
import { canTransitionTaskStatus } from './state-machine';

const entityIdSchema = z
  .string({ required_error: 'Identifier is required' })
  .trim()
  .cuid({ message: 'Identifier must be a valid CUID' });

const titleSchema = z
  .string({ required_error: 'Title is required' })
  .trim()
  .min(1, 'Title cannot be empty')
  .max(255, 'Title must be at most 255 characters');

const descriptionSchema = z
  .string()
  .trim()
  .max(10_000, 'Description must be at most 10000 characters')
  .nullable()
  .optional();

const dueDateSchema = z.coerce
  .date({ invalid_type_error: 'Due date must be a valid date' })
  .nullable()
  .optional();

const estimatePointsSchema = z
  .number({ invalid_type_error: 'Estimate must be a number' })
  .int('Estimate must be an integer')
  .min(0, 'Estimate cannot be negative')
  .max(100, 'Estimate must be at most 100')
  .nullable()
  .optional();

export const taskStatusSchema = z.nativeEnum(TaskStatus, {
  required_error: 'Status is required',
  invalid_type_error: 'Status is invalid',
});

export const taskPrioritySchema = z.nativeEnum(TaskPriority, {
  required_error: 'Priority is required',
  invalid_type_error: 'Priority is invalid',
});

export const createTaskSchema = z
  .object({
    workspaceId: entityIdSchema,
    projectId: entityIdSchema.nullable().optional(),
    parentTaskId: entityIdSchema.nullable().optional(),
    assigneeId: entityIdSchema.nullable().optional(),
    title: titleSchema,
    description: descriptionSchema,
    status: taskStatusSchema.default(TaskStatus.BACKLOG),
    priority: taskPrioritySchema.default(TaskPriority.MEDIUM),
    dueDate: dueDateSchema,
    estimatePoints: estimatePointsSchema,
    labelIds: z.array(entityIdSchema).max(50, 'A task can have at most 50 labels').default([]),
  })
  .strict();

export const updateTaskStatusSchema = z
  .object({
    taskId: entityIdSchema,
    fromStatus: taskStatusSchema,
    toStatus: taskStatusSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!canTransitionTaskStatus(value.fromStatus, value.toStatus)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toStatus'],
        message: `Transition from "${value.fromStatus}" to "${value.toStatus}" is not allowed`,
      });
    }
  });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
