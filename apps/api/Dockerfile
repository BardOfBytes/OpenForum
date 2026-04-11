# -----------------------------------------------------------
# Stage 1: Chef — prepare dependency recipe
# -----------------------------------------------------------
FROM rust:1.82-slim-bookworm AS chef
RUN cargo install cargo-chef
WORKDIR /app

# -----------------------------------------------------------
# Stage 2: Planner — generate recipe.json
# -----------------------------------------------------------
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# -----------------------------------------------------------
# Stage 3: Builder — compile dependencies + application
# -----------------------------------------------------------
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
# Build only dependencies (cached layer)
RUN cargo chef cook --release --recipe-path recipe.json
# Build the full application
COPY . .
RUN cargo build --release

# -----------------------------------------------------------
# Stage 4: Runtime — minimal image with only the binary
# -----------------------------------------------------------
FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/openforum-api /app/openforum-api
EXPOSE 3001
CMD ["/app/openforum-api"]
