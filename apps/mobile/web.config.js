module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: wss: http://localhost:* *.up.railway.app *.railway.app; img-src 'self' data: blob: https: http://localhost:* *.up.railway.app *.railway.app; font-src 'self' data: https: http://localhost:* *.up.railway.app *.railway.app; style-src 'self' 'unsafe-inline' https: http://localhost:*; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https: http://localhost:* *.up.railway.app *.railway.app; connect-src 'self' blob: https: wss: http://localhost:* *.up.railway.app *.railway.app; worker-src 'self' blob:; frame-src 'self' blob: https: http://localhost:* *.up.railway.app *.railway.app;"
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          }
        ]
      }
    ];
  }
};
