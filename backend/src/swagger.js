const swaggerUi = require('swagger-ui-express');

const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'FleetFlow TMS API',
    version: '1.0.0',
    description: 'Transport Management System REST API for FleetFlow TMS.',
  },
  servers: [{ url: 'http://localhost:4000', description: 'Local Development' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: { summary: 'Health check', responses: { 200: { description: 'OK' } } },
    },
    '/health/detailed': {
      get: { summary: 'Detailed health check (Admin)', responses: { 200: { description: 'Pool & memory stats' } } },
    },
    '/api/v1/auth/login': {
      post: {
        summary: 'Login user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'admin@tms.com' },
                  password: { type: 'string', example: 'Admin@123' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Access token + user profile' }, 401: { description: 'Invalid credentials' } },
      },
    },
    '/api/v1/auth/refresh': { post: { summary: 'Rotate refresh token', responses: { 200: { description: 'New access token' } } } },
    '/api/v1/auth/logout': { post: { summary: 'Logout and revoke refresh token', responses: { 200: { description: 'Logged out' } } } },
    '/api/v1/auth/register': { post: { summary: 'Register customer account', responses: { 201: { description: 'Customer created' } } } },
    '/api/v1/auth/me': { get: { summary: 'Get current user', responses: { 200: { description: 'User + profile' } } } },
    '/api/v1/auth/password': { patch: { summary: 'Change password', responses: { 200: { description: 'Password updated' } } } },
    '/api/v1/vehicles': {
      get: { summary: 'List vehicles', responses: { 200: { description: 'Paginated vehicles' } } },
      post: { summary: 'Create vehicle', responses: { 201: { description: 'Vehicle created' }, 409: { description: 'Duplicate reg/VIN' } } },
    },
    '/api/v1/drivers': {
      get: { summary: 'List drivers', responses: { 200: { description: 'Paginated drivers' } } },
      post: { summary: 'Create driver', responses: { 201: { description: 'Driver created' } } },
    },
    '/api/v1/routes': {
      get: { summary: 'List routes', responses: { 200: { description: 'Paginated routes' } } },
      post: { summary: 'Create route', responses: { 201: { description: 'Route created' } } },
    },
    '/api/v1/trips': {
      get: { summary: 'List trips (role-scoped)', responses: { 200: { description: 'Paginated trips' } } },
      post: { summary: 'Schedule trip', responses: { 201: { description: 'Trip created' }, 409: { description: 'Overlap or expired license' } } },
    },
    '/api/v1/trips/{id}/status': { patch: { summary: 'Update trip status', responses: { 200: { description: 'Status updated' } } } },
    '/api/v1/trips/{id}/location': { post: { summary: 'Push GPS location ping (Driver)', responses: { 200: { description: 'Location updated' } } } },
    '/api/v1/bookings': {
      get: { summary: 'List bookings (role-scoped)', responses: { 200: { description: 'Paginated bookings' } } },
      post: { summary: 'Create booking (Customer)', responses: { 201: { description: 'Booking created' } } },
    },
    '/api/v1/bookings/{id}/assign': { patch: { summary: 'Assign booking to trip (Admin)', responses: { 200: { description: 'Booking confirmed' } } } },
    '/api/v1/reports/kpis': { get: { summary: 'Get operational KPIs (Admin)', responses: { 200: { description: 'KPI snapshot' } } } },
    '/api/v1/reports/fuel-efficiency': { get: { summary: 'Fuel efficiency report', responses: { 200: { description: 'Vehicle fuel metrics' } } } },
    '/api/v1/reports/revenue': { get: { summary: 'Monthly revenue report', responses: { 200: { description: 'Revenue series' } } } },
    '/api/v1/search': { get: { summary: 'Global search', responses: { 200: { description: 'Grouped search results' } } } },
    '/api/v1/notifications': { get: { summary: 'List user notifications', responses: { 200: { description: 'Notifications list' } } } },
  },
};

function mountSwagger(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

module.exports = { swaggerSpec, mountSwagger };
