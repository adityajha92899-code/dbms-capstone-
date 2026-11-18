const { z } = require('zod');

const createBookingSchema = z.object({
  pickup_location: z.string().trim().min(2).max(150),
  delivery_location: z.string().trim().min(2).max(150),
  pickup_datetime: z.coerce.date(),
  cargo_weight_kg: z.coerce.number().positive(),
  cargo_description: z.string().trim().min(3).max(1000),
  volume_cbm: z.coerce.number().positive().optional().nullable(),
});

const queryBookingSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'in_transit', 'delivered', 'cancelled']).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const assignBookingSchema = z.object({
  trip_id: z.string().uuid(),
});

const bookingStatusUpdateSchema = z.object({
  status: z.enum(['confirmed', 'in_transit', 'delivered', 'cancelled']),
});

module.exports = {
  createBookingSchema,
  queryBookingSchema,
  assignBookingSchema,
  bookingStatusUpdateSchema,
};
