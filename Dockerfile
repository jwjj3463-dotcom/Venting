FROM node:20-slim

WORKDIR /app

# Install dependencies with global tsx for flawless execution
COPY package*.json ./
RUN npm install --legacy-peer-deps && npm install -g tsx

# Copy source files
COPY . .

# Build frontend bundle
RUN npm run build

# Built-in production configuration defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV PATH="/app/node_modules/.bin:${PATH}"
ENV VITE_API_SERVER_URL=https://web-production-d1043.up.railway.app
ENV APP_URL=https://web-production-d1043.up.railway.app
ENV VITE_CLOUDFLARE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
ENV CLOUDFLARE_TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
ENV OWNER_BOOTSTRAP_TOKEN=sohba-chat-owner-bootstrap-secret-token-2026-secure
ENV OWNER_RECOVERY_TOKEN=sohba-chat-owner-recovery-secret-token-2026-secure
ENV TURN_SERVER_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
ENV TURN_SHARED_SECRET=sohba-chat-turn-shared-secret-key-2026

EXPOSE 3000

CMD ["npm", "start"]
