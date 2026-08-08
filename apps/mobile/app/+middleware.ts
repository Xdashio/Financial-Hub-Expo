// Middleware for Expo Router v57 web compatibility
// This prevents "Cannot read properties of undefined (reading 'keys')" error on web
// by explicitly exporting an empty middleware array

export const middleware = [];