FROM node:22-bookworm-slim

# Install git (required by git-server.mjs and isomorphic-git)
RUN apt-get update && apt-get install -y git python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json ./

# Install dependencies (skip electron since we're running web-only)
RUN npm ci --ignore-scripts && \
    npm rebuild node-pty --update-binary || true

# Copy the rest of the source
COPY . .

# Expose Vite dev server and git backend ports
EXPOSE 5173 3001

# Start both git-server and vite dev server
CMD ["npm", "run", "dev"]
