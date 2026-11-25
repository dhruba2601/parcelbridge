export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'PARCELBRIDGE REST API',
    version: '1.0.0',
    description:
      'Universal E-commerce Parcel Management and Scheduled Last-Mile Delivery Platform API. External courier/e-commerce webhooks require HMAC-SHA256 signature verification.',
  },
  servers: [
    { url: '/api/v1', description: 'API v1' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    '/health': { get: { summary: 'Health check', responses: { '200': { description: 'OK' } } } },
    '/auth/register': { post: { summary: 'Register customer or partner account', responses: { '201': { description: 'Created' } } } },
    '/auth/login': { post: { summary: 'Authenticate user and obtain JWT', responses: { '200': { description: 'Authenticated' } } } },
    '/auth/logout': { post: { summary: 'Logout session', responses: { '200': { description: 'Logged out' } } } },
    '/auth/me': { get: { summary: 'Get authenticated profile', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Profile' } } } },
    '/parcels': {
      get: { summary: 'List parcels (scoped by role)', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Parcel list' } } },
      post: { summary: 'Register incoming parcel (Admin/Hub Manager)', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Parcel created' } } },
    },
    '/parcels/{id}': {
      get: { summary: 'Get parcel details, timeline & QR code', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Parcel details' } } },
    },
    '/parcels/{id}/status': {
      patch: { summary: 'Transition parcel lifecycle status', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Updated' } } },
    },
    '/parcels/track/{trackingId}': {
      get: { summary: 'Track parcel by external or internal ID', responses: { '200': { description: 'Tracking summary' } } },
    },
    '/parcels/scan-qr': {
      post: { summary: 'Verify and scan opaque HMAC-signed QR token', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Scanned' } } },
    },
    '/delivery-slots': {
      get: { summary: 'List available delivery slots', responses: { '200': { description: 'Slots' } } },
    },
    '/delivery-bookings': {
      get: { summary: 'List customer bookings', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Bookings' } } },
      post: { summary: 'Atomically reserve a delivery slot', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Reserved' }, '409': { description: 'Slot full' } } },
    },
    '/delivery-bookings/{id}': {
      patch: { summary: 'Reschedule delivery booking atomically', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Rescheduled' } } },
      delete: { summary: 'Cancel delivery booking', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Cancelled' } } },
    },
    '/admin/dashboard': {
      get: { summary: 'Get operational KPIs and recent activity', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Dashboard metrics' } } },
    },
    '/admin/societies': {
      post: { summary: 'Create residential society', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Created' } } },
    },
    '/admin/hubs': {
      post: { summary: 'Create parcel hub', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Created' } } },
    },
    '/delivery/assignments': {
      get: { summary: 'Get assigned deliveries for logged-in delivery staff', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Assignments' } } },
    },
    '/delivery/dispatch': {
      post: { summary: 'Assign parcel to delivery staff & issue OTP', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Dispatched' } } },
    },
    '/delivery/verify-otp': {
      post: { summary: 'Verify customer handover OTP', security: [{ bearerAuth: [] }], responses: { '200': { description: 'OTP Verified' } } },
    },
    '/delivery/confirm': {
      post: { summary: 'Verify OTP and confirm parcel delivery', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Delivered' } } },
    },
    '/partners/apply': {
      post: { summary: 'Submit business/logistics partnership enquiry', responses: { '201': { description: 'Application submitted' } } },
    },
    '/partners/applications': {
      get: { summary: 'List partnership applications', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Applications' } } },
    },
    '/webhooks/courier-event': {
      post: { summary: 'Partner webhook endpoint (HMAC-SHA256 verified)', responses: { '202': { description: 'Accepted' }, '401': { description: 'Invalid signature' } } },
    },
  },
};
