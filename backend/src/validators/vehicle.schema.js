const { z } = require('zod');

const VEHICLE_TYPES = ['semi_truck', 'box_truck', 'van', 'flatbed', 'reefer'];
const FUEL_TYPES = ['diesel', 'petrol', 'electric', 'hybrid'];
const VEHICLE_STATUSES = ['available', 'in_transit', 'maintenance', 'retired', 'inactive'];
const MAINTENANCE_TYPES = ['routine', 'repair', 'inspection', 'tire', 'emergency'];
const MAINTENANCE_STATUSES = ['scheduled', 'in_progress', 'completed'];

const createVehicleSchema = z.object({
  reg_number: z.string().trim().min(2).max(30),
  vin: z.string().trim().min(5).max(32),
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  year: z.coerce.number().int().min(1990).max(2100),
  vehicle_type: z.enum(VEHICLE_TYPES),
  capacity_kg: z.coerce.number().positive(),
  volume_cbm: z.coerce.number().positive().optional().nullable(),
  fuel_type: z.enum(FUEL_TYPES).optional().default('diesel'),
  odometer_km: z.coerce.number().min(0).optional().default(0),
  status: z.enum(VEHICLE_STATUSES).optional().default('available'),
  insurance_expiry: z.string().trim().min(4),
});

const updateVehicleSchema = createVehicleSchema.partial();

const queryVehicleSchema = z.object({
  status: z.enum(VEHICLE_STATUSES).optional(),
  type: z.enum(VEHICLE_TYPES).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const createMaintenanceSchema = z.object({
  maintenance_type: z.enum(MAINTENANCE_TYPES),
  description: z.string().trim().min(3),
  cost: z.coerce.number().min(0).optional().default(0),
  odometer_at_service: z.coerce.number().min(0).optional().nullable(),
  service_date: z.string().trim().optional(),
  next_service_date: z.string().trim().optional().nullable(),
  performed_by: z.string().trim().max(150).optional().nullable(),
  status: z.enum(MAINTENANCE_STATUSES).optional().default('in_progress'),
});

module.exports = {
  createVehicleSchema,
  updateVehicleSchema,
  queryVehicleSchema,
  createMaintenanceSchema,
};
