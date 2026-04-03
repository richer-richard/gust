# ---------------------------------------------------------------------------
# Stage 1 -- Base image with all build tooling
# ---------------------------------------------------------------------------
FROM ubuntu:24.04 AS base

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    build-essential \
    cmake \
    pkg-config \
    libwebkit2gtk-4.1-dev \
    libappindicator3-dev \
    librsvg2-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Rust via rustup
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Node 20 via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm 10
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# ---------------------------------------------------------------------------
# Stage 2 -- Build the project
# ---------------------------------------------------------------------------
FROM base AS build

COPY . /app
WORKDIR /app

RUN pnpm install
RUN cargo build --release
RUN cd apps/desktop && pnpm build:web

# Note: A full Tauri bundle on Linux requires additional GTK runtime
# dependencies. This Dockerfile builds the Rust backend and Vite frontend
# for reproducible CI validation; use the GitHub release workflow for
# distributable .deb / .AppImage artifacts.
