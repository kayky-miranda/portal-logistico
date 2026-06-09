/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "bcryptjs", "@anthropic-ai/sdk"],
  experimental: {
    // Permite que o login e demais Server Actions funcionem quando o app é
    // acessado por um domínio de túnel (Cloudflare/ngrok/localtunnel). Sem isto,
    // o Next bloqueia o POST por proteção contra CSRF (origem ≠ host).
    serverActions: {
      allowedOrigins: [
        "*.trycloudflare.com",
        "*.ngrok-free.app",
        "*.ngrok.io",
        "*.loca.lt",
      ],
    },
  },
};

export default nextConfig;
