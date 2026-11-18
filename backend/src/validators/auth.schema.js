const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const registerSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().trim().min(2, 'Full name is required').max(150),
  phone: z.string().trim().min(5, 'Phone is required').max(30),
  company_name: z.string().trim().min(2, 'Company name is required').max(200),
});

const refreshSchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
  })
  .optional()
  .default({});

module.exports = {
  loginSchema,
  registerSchema,
  refreshSchema,
};
