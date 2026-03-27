FROM node:22-bullseye

# Install git, Java (required by Soot/apktool), and apktool
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    openjdk-17-jdk \
    apktool \
    python3 \
    python3-pip \
    && pip3 install --no-cache-dir scapy \
    && rm -rf /var/lib/apt/lists/*

# Set JAVA_HOME dynamically — works on both amd64 (Linux/Windows) and arm64 (Apple Silicon)
RUN echo "export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))" >> /etc/profile
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
RUN if [ -d "/usr/lib/jvm/java-17-openjdk-arm64" ]; then \
      ln -sfn /usr/lib/jvm/java-17-openjdk-arm64 /usr/lib/jvm/java-17-openjdk; \
    else \
      ln -sfn /usr/lib/jvm/java-17-openjdk-amd64 /usr/lib/jvm/java-17-openjdk; \
    fi
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk
ENV PATH="${JAVA_HOME}/bin:${PATH}"

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
