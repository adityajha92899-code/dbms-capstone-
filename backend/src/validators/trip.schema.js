const { z } = require('zod');

const createTripSchema = z
  .object({
    vehicle_id: z.string().uuid(),
    driver_id: z.string().uuid(),
    route_id: z.string().uuid(),
    scheduled_start: z.coerce.date(),
    scheduled_end: z.coerce.date(),
    booking_ids: z.array(z.string().uuid()).optional().default([]),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((data) => data.scheduled_end > data.scheduled_start, {
    message: 'scheduled_end must be after scheduled_start',
    path: ['scheduled_end'],
  });

const queryTripSchema = z.object({
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  driver_id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const tripStatusUpdateSchema = z.object({
  status: z.enum(['in_progress', 'completed', 'cancelled']),
});

const tripLocationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

module.exports = {
  createTripSchema,
  queryTripSchema,
  tripStatusUpdateSchema,
  tripLocationSchema,
};
