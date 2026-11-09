FROM node:20-slim

WORKDIR /app

# Built-in production configuration defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV VITE_API_SERVER_URL=https://web-production-d1043.up.railway.app
ENV VITE_CLOUDFLARE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
ENV CLOUDFLARE_TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
ENV OWNER_BOOTSTRAP_TOKEN=sohba-chat-owner-bootstrap-secret-token-2026

# Install dependencies first for optimal Docker layer caching
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source files
COPY . .

# Build frontend bundle
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
