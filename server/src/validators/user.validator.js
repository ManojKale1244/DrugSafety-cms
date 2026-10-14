import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string({ required_error: 'Name is required' }).trim().min(2, 'Name must be at least 2 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .email('Please enter a valid email address')
    .trim()
    .toLowerCase(),
  roleId: z.string({ required_error: 'Role is required' }).min(1, 'Role ID is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, 'Password must contain at least one special character')
    .optional(),
  mustChangePassword: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().email().trim().toLowerCase().optional(),
  roleId: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  mustChangePassword: z.boolean().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['active', 'inactive'], {
    required_error: 'Status must be active or inactive',
  }),
});

export const bulkStatusSchema = z.object({
  userIds: z.array(z.string()).min(1, 'Select at least one user'),
  status: z.enum(['active', 'inactive'], {
    required_error: 'Status must be active or inactive',
  }),
});
