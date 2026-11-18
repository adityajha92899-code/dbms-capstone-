export const ROLES = {
  ADMIN: 'admin',
  DISPATCHER: 'dispatcher',
  DRIVER: 'driver',
  CUSTOMER: 'customer',
};

export const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-700',
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  in_transit: 'bg-amber-100 text-amber-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  active: 'bg-emerald-100 text-emerald-800',
  available: 'bg-emerald-100 text-emerald-800',
  inactive: 'bg-slate-100 text-slate-700',
  maintenance: 'bg-amber-100 text-amber-800',
  suspended: 'bg-red-100 text-red-800',
};

export const ROLE_HOME = {
  admin: '/admin/dashboard',
  dispatcher: '/admin/dashboard',
  driver: '/driver/dashboard',
  customer: '/customer/dashboard',
};
