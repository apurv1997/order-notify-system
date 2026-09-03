# Kubernetes manifests (local, via kind)

Deploys the same system as `docker-compose.yml`, but on Kubernetes. Tested locally
with [kind](https://kind.sigs.k8s.io/) (Kubernetes-in-Docker).

## Prerequisites

- Docker Desktop running
- `kubectl`, `kind`, `helm`

## 1. Create the cluster

```bash
kind create cluster --name order-notify
```

## 2. Build and load the app images

kind runs Kubernetes inside Docker containers, so it can't pull images that only
exist in your local Docker Desktop — they have to be explicitly loaded in.

```bash
docker compose build api-service worker-service
kind load docker-image order-notify-system-api-service:latest --name order-notify
kind load docker-image order-notify-system-worker-service:latest --name order-notify
```

## 3. Install KEDA (needed for the worker's HPA)

Plain Kubernetes HPA only scales on CPU/memory. The worker scales on **RabbitMQ
queue depth** instead, which needs [KEDA](https://keda.sh/) (Kubernetes
Event-Driven Autoscaling) — it has a built-in RabbitMQ scaler.

```bash
helm repo add kedacore https://kedacore.github.io/charts
helm repo update
kubectl create namespace keda
helm install keda kedacore/keda --namespace keda
kubectl wait --for=condition=Ready pods --all -n keda --timeout=120s
```

## 4. Deploy everything

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml -f k8s/secret.yaml -f k8s/mysql-schema-configmap.yaml
kubectl apply -f k8s/mysql-pvc.yaml -f k8s/redis-deployment.yaml -f k8s/redis-service.yaml \
  -f k8s/rabbitmq-deployment.yaml -f k8s/rabbitmq-service.yaml \
  -f k8s/mysql-deployment.yaml -f k8s/mysql-service.yaml

# wait for redis/rabbitmq/mysql to be ready, then:
kubectl apply -f k8s/api-service-deployment.yaml -f k8s/api-service-service.yaml \
  -f k8s/worker-service-deployment.yaml -f k8s/worker-hpa.yaml
```

## 5. Verify

```bash
kubectl get pods -n order-notify
kubectl get scaledobject,hpa -n order-notify

kubectl port-forward -n order-notify svc/api-service 3000:3000
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId": "cust-k8s", "items": [{"sku": "SKU-1", "qty": 1}]}'
```

## What's in here

| File | Purpose |
|---|---|
| `namespace.yaml` | Isolates everything under the `order-notify` namespace |
| `configmap.yaml` | Non-secret env vars shared by both app services |
| `secret.yaml` | MySQL password + RabbitMQ management API credential (for KEDA) |
| `mysql-schema-configmap.yaml` | Mirrors `worker-service/src/db/schema.sql`, mounted into MySQL's `/docker-entrypoint-initdb.d` so tables are created on first boot |
| `redis-*.yaml`, `rabbitmq-*.yaml`, `mysql-*.yaml` | Deployment + Service (+ PVC for MySQL) for each dependency |
| `api-service-*.yaml` | Deployment + NodePort Service for the API |
| `worker-service-deployment.yaml` | Deployment for the worker (no Service — it never receives inbound traffic) |
| `worker-hpa.yaml` | KEDA `TriggerAuthentication` + `ScaledObject` — scales `worker-service` (1-5 replicas) based on the `order-processing` queue's message count, via RabbitMQ's management API |

## Notes

- Images use `imagePullPolicy: Never` since they're loaded locally via `kind load`,
  not pulled from a registry.
- `worker-hpa.yaml` targets 5 messages per replica (`value: "5"`) — tune this once
  you have real throughput numbers from Step 9 (load testing).
- Secrets here use plaintext values suitable for local dev only. Production secrets
  management is addressed when deploying to EKS (Step 6).
