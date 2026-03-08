import { z } from 'zod';

/**
 * identifySchema — Validates the POST /identify request body.
 *
 * Rules (from spec):
 *  - At least one of email or phoneNumber must be present and non-null.
 *  - email must be a valid email format if provided.
 *  - phoneNumber is treated as a string (spec shows it quoted in examples).
 */
export const identifySchema = z
  .object({
    email: z
      .string({ invalid_type_error: 'email must be a string' })
      .email('Invalid email format')
      .toLowerCase()
      .trim()
      .optional()
      .nullable(),

    phoneNumber: z
      .union([z.string().trim(), z.number().transform(String)])
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      // At least one field must be a non-null, non-empty value
      const hasEmail = data.email != null && data.email !== '';
      const hasPhone = data.phoneNumber != null && data.phoneNumber !== '';
      return hasEmail || hasPhone;
    },
    {
      message: 'At least one of email or phoneNumber is required',
    },
  );

export type IdentifyInput = z.infer<typeof identifySchema>;