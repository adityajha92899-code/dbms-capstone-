const { z } = require('zod');

const LICENSE_CLASSES = ['CDL-A', 'CDL-B', 'CDL-C', 'LMV'];
const DRIVER_STATUSES = ['available', 'on_trip', 'off_duty', 'suspended'];

const queryDriverSchema = z.object({
  status: z.enum(DRIVER_STATUSES).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const createDriverSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  full_name: z.string().trim().min(2).max(150),
  phone: z.string().trim().min(5).max(30).optional().nullable(),
  license_number: z.string().trim().min(3).max(50),
  license_class: z.enum(LICENSE_CLASSES),
  license_expiry: z.string().trim().min(4),
  hire_date: z.string().trim().optional(),
});

const updateDriverStatusSchema = z.object({
  status: z.enum(DRIVER_STATUSES),
});

module.exports = {
  queryDriverSchema,
  createDriverSchema,
  updateDriverStatusSchema,
};
