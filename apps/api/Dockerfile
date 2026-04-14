# Stage 1: Build the Rust API with musl for a statically linked binary
FROM rust:1.78-slim AS builder

# Install musl-tools for static compilation
RUN apt-get update && apt-get install -y musl-tools

# Add the musl target
RUN rustup target add x86_64-unknown-linux-musl

WORKDIR /app

# Cache dependencies by building a dummy project first
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src \
    && echo "fn main() {}" > src/main.rs \
    && cargo build --release --target x86_64-unknown-linux-musl \
    && rm -rf src

# Copy the actual source code
COPY src ./src

# Build the final binary (touching main to force rebuild)
RUN touch src/main.rs \
    && cargo build --release --target x86_64-unknown-linux-musl

# Stage 2: Minimal runtime environment
FROM alpine:3.19

# Set up a non-root user (uid 1000) for security
RUN addgroup -S appgroup -g 1000 \
    && adduser -S appuser -G appgroup -u 1000

WORKDIR /app

# Copy the statically linked binary from the builder stage
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/openforum-api .

# Change ownership of the binary
RUN chown appuser:appgroup openforum-api \
    && chmod +x openforum-api

# Switch to the non-root user
USER appuser

# Expose the API port
EXPOSE 8080

# Default environment variable
ENV PORT=8080

CMD ["./openforum-api"]
