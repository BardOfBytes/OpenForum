.PHONY: dev build docker-up docker-down test

# Run frontend Next.js and backend Rust server simultaneously for dev
dev:
	pnpm dev & cd apps/api && cargo run

# Build production artifacts locally
build:
	pnpm run build && cd apps/api && cargo build --release

# Start docker-compose local environment (Redis + AXUM container)
docker-up:
	docker-compose up --build -d

# Stop docker-compose local environment
docker-down:
	docker-compose down

# Run Rust AXUM backend tests
test:
	cd apps/api && cargo test
