# Standard Node Dockerfile (Go)
FROM golang:1.21-alpine AS builder

# Install git (needed for go mod)
RUN apk add --no-cache git

WORKDIR /app

# Copy everything including vendor directory
COPY . .

# Verify go.mod and go.sum exist
RUN test -f go.mod || (echo "go.mod not found" && exit 1)

# Use vendored dependencies if available, otherwise download
RUN if [ -d vendor ]; then \
        echo "Using vendored dependencies"; \
    else \
        echo "Downloading dependencies"; \
        go mod download || go mod vendor; \
    fi

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/*.go

# Production stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy binary
COPY --from=builder /app/main .

EXPOSE 4000

CMD ["./main"]
