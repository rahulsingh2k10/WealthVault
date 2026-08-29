/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  async rewrites() {
    return [
      // /api-docs/ groups api-docs.html + redoc.standalone.js together under
      // public/. This keeps the short, memorable /api-docs.html URL working
      // as a transparent alias (no redirect — same URL, same request) rather
      // than moving the files back out of that folder.
      { source: "/api-docs.html", destination: "/api-docs/api-docs.html" },
    ];
  },
};

export default nextConfig;
