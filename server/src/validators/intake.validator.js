import { z } from 'zod';

export const createIntakeSchema = z.object({
  source: z.enum(['physician', 'patient', 'literature', 'regulator', 'other']).optional().default('physician'),
  receiptDate: z
    .string({ required_error: 'Receipt date is required' })
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid receipt date format' })
    .refine((val) => new Date(val).getTime() <= Date.now(), {
      message: 'Receipt date cannot be set in the future',
    }),
  reporter: z
    .object({
      name: z.string().trim().optional().default(''),
      qualification: z.string().trim().optional().default('Physician'),
      contact: z.string().trim().optional().default(''),
      country: z.string().trim().optional().default('India'),
    })
    .optional()
    .default({}),
  patient: z
    .object({
      reference: z.string().trim().optional().default(''),
      age: z.number().nullable().optional().default(null),
      ageUnit: z.enum(['years', 'months', 'days', 'decades']).optional().default('years'),
      sex: z.enum(['Male', 'Female', 'Other', 'Unknown']).optional().default('Unknown'),
      weight: z.number().nullable().optional().default(null),
    })
    .optional()
    .default({}),
  suspectedProduct: z
    .string({ required_error: 'Suspected product is required' })
    .trim()
    .min(1, 'Suspected product cannot be empty'),
  reportedReaction: z
    .string({ required_error: 'Reported adverse reaction is required' })
    .trim()
    .min(1, 'Reported adverse reaction cannot be empty'),
  narrative: z.string().optional().default(''),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.string().optional().default(''),
        size: z.number().optional().default(0),
        uploadedAt: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
});

export const updateIntakeSchema = z.object({
  source: z.enum(['physician', 'patient', 'literature', 'regulator', 'other']).optional(),
  receiptDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid receipt date format' })
    .refine((val) => new Date(val).getTime() <= Date.now(), {
      message: 'Receipt date cannot be set in the future',
    })
    .optional(),
  reporter: z
    .object({
      name: z.string().trim().optional(),
      qualification: z.string().trim().optional(),
      contact: z.string().trim().optional(),
      country: z.string().trim().optional(),
    })
    .optional(),
  patient: z
    .object({
      reference: z.string().trim().optional(),
      age: z.number().nullable().optional(),
      ageUnit: z.enum(['years', 'months', 'days', 'decades']).optional(),
      sex: z.enum(['Male', 'Female', 'Other', 'Unknown']).optional(),
      weight: z.number().nullable().optional(),
    })
    .optional(),
  suspectedProduct: z.string().trim().min(1).optional(),
  reportedReaction: z.string().trim().min(1).optional(),
  narrative: z.string().optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.string().optional(),
        size: z.number().optional(),
        uploadedAt: z.string().optional(),
      }),
    )
    .optional(),
});

export const rejectIntakeSchema = z.object({
  reason: z
    .string({ required_error: 'Rejection reason is mandatory' })
    .trim()
    .min(3, 'Rejection reason must be at least 3 characters long'),
});
