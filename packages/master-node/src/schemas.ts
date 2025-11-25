import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(3).max(255),
  password: z.string().min(8).max(255),
  deviceName: z.string().min(1).max(255).optional().default('Default Device'),
});

export const loginSchema = z.object({
  username: z.string().min(3).max(255),
  password: z.string().min(8).max(255),
  deviceName: z.string().min(1).max(255).optional().default('Default Device'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
