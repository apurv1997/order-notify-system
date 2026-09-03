# Order Processing & Notification System

A backend + platform engineering portfolio project: an async, event-driven order
processing pipeline built with Node.js, RabbitMQ, Redis, and MySQL, deployed with
Docker/Kubernetes and infrastructure as code.

## Architecture at a glance

```
Client -> api-service -> RabbitMQ (order.created) -> worker-service -> MySQL
             |                                             |
           Redis (rate limit + idempotency)           Redis (idempotency)
```

- **api-service** (Node.js/Express) — accepts `POST /orders`, rate-limits and checks
  idempotency via Redis, publishes an `order.created` event to RabbitMQ, and responds
  `202 Accepted` immediately without waiting on downstream processing.
- **worker-service** (Node.js) — consumes `order.created` events, re-checks
  idempotency, and writes the order, its items, and a notification record to MySQL
  inside a single transaction. Scales independently of the API.
- **RabbitMQ** — decouples intake from processing; failed messages are dead-lettered
  rather than retried forever or dropped silently.
- **Redis** — API rate limiting, plus idempotency keys used by both services.
- **MySQL** — source of truth for `orders`, `order_items`, and `notifications`.

## Repo layout

```
.
├── api-service/        # Express API: intake, rate limiting, idempotency, publishing
│   └── src/
│       ├── config/      # env var loading
│       ├── lib/         # redis, rabbitmq clients
│       ├── middleware/  # rateLimit, idempotency
│       ├── controllers/ # request handlers
│       └── routes/      # path -> controller wiring only
├── worker-service/      # Consumer: processes order.created, writes to MySQL
│   └── src/
│       ├── config/       # env var loading
│       ├── lib/          # redis, rabbitmq, mysql clients
│       ├── controllers/  # per-message processing logic
│       └── db/           # schema.sql + migration runner
├── docker-compose.yml    # Full local stack: both services + Redis, RabbitMQ, MySQL
└── README.md
```

## Running locally with Docker Compose (recommended)

Prerequisites: Docker Desktop.

```bash
docker compose up --build
```

This builds and starts Redis, RabbitMQ, MySQL, `api-service`, and `worker-service`.
MySQL's schema (`worker-service/src/db/schema.sql`) is applied automatically on first
startup. Services wait for their dependencies to report healthy before starting.

- API: http://localhost:3000
- RabbitMQ management UI: http://localhost:15672 (guest/guest)
- MySQL: `localhost:3308` (root, no password, database `order_notify`)

### Try it

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-order-1" \
  -d '{"customerId": "cust-123", "items": [{"sku": "SKU-1", "qty": 2}]}'
```

Check the order landed in MySQL:

```bash
mysql -h 127.0.0.1 -P 3308 -u root order_notify -e "SELECT * FROM orders;"
```

Stop everything with `docker compose down` (add `-v` to also drop the MySQL data volume).

## Running natively (without Docker)

Each service can also run directly with Node.js against Redis/RabbitMQ/MySQL
installed locally (e.g. via Homebrew). Copy `.env.example` to `.env` in each service
directory, adjust connection details if needed, then:

```bash
cd api-service && npm install && npm start
cd worker-service && npm install && npm run migrate && npm start
```

## API reference

### `GET /health`

Returns `200 { "status": "ok" }`.

### `POST /orders`

| Header | Required | Purpose |
|---|---|---|
| `Content-Type: application/json` | Yes | |
| `Idempotency-Key` | No | Replays the cached response for a repeated request instead of creating a duplicate order |
| `X-API-Key` | No | Rate-limit bucket key; falls back to client IP if omitted |

Body:

```json
{
  "customerId": "cust-123",
  "items": [{ "sku": "SKU-1", "qty": 2 }]
}
```

Responses: `202` (accepted), `400` (validation error), `409` (idempotency key in
progress), `429` (rate limit exceeded), `503` (failed to publish, safe to retry).

## Roadmap

1. ✅ API + worker services, verified end-to-end locally
2. ✅ Dockerized, full stack verified via `docker compose up`
3. Kubernetes manifests, deployed locally (Minikube/kind)
4. AWS CDK for EKS + supporting infra (VPC, RDS, Redis, MQ)
5. Deploy the same K8s manifests to EKS
6. CI/CD via GitHub Actions
7. Observability: Prometheus + Grafana (queue depth, request latency, worker throughput)
8. Load testing with documented benchmarks
9. Terraform version of the same infra (coexists with CDK)
10. Written tradeoffs/postmortem doc

## Git workflow

- `main` is protected — no direct pushes; all work lands via PR.
- Branch per phase (`feature/api-service`, `feature/worker-service`,
  `feature/dockerize`, ...).
- [Conventional Commits](https://www.conventionalcommits.org/) (`feat(api): ...`,
  `feat(worker): ...`, `infra(cdk): ...`, `ci: ...`, `docs: ...`).
