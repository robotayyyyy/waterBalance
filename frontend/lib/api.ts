/**
 * Get the API base URL based on environment
 *
 * Production/Docker: Uses /api (proxied through nginx)
 * Development: Uses http://localhost:3001 (direct backend connection)
 */
export function getApiUrl(): string {

  console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);

  return process.env.NEXT_PUBLIC_API_URL || '/api';

  // // Browser: detect environment
  // const isDev = window.location.hostname === 'localhost' &&
  //               window.location.port === '3000';

  // return isDev ? 'http://localhost:3001' : '/api';
}
