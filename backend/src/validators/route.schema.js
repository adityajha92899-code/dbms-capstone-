const { z } = require('zod');

const queryRouteSchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const createRouteSchema = z.object({
  code: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(150),
  origin: z.string().trim().min(2).max(150),
  destination: z.string().trim().min(2).max(150),
  distance_km: z.coerce.number().positive(),
  estimated_duration_hrs: z.coerce.number().positive(),
  base_rate_per_km: z.coerce.number().min(0).optional().default(2.5),
  is_active: z.boolean().optional().default(true),
});

const updateRouteSchema = createRouteSchema.partial();

module.exports = {
  queryRouteSchema,
  createRouteSchema,
  updateRouteSchema,
};
