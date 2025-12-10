### Project Name: Intellidine
## Description:
A multi-tenant SaaS platform for restaurants that digitizes ordering, payments, and in-restaurant operations. Customers scan table-specific QR codes to browse menus, place orders, and pay. Staff interfaces support order management, kitchen operations, and inventory tracking. Built using a microservices architecture with tenant isolation, event-driven communication, and scalable infrastructure.

## Technologies Used:

- Backend & Services: TypeScript, Node.js (NestJS), PostgreSQL (Prisma ORM)
- Event Streaming: Kafka
- Caching & Sessions: Redis
- Payments & Communication: Razorpay, MSG91 (SMS/OTP)
- Infrastructure: Docker, Docker Compose, Nginx
- Monitoring: Prometheus, Grafana
- Testing: Jest

## Key Highlights:

- Multi-tenant architecture with strict tenant isolation via tenant_id at JWT and database levels
- 8-service microservices setup: auth, menu, order, payment, inventory, notification, analytics, discount-engine
- Event-driven communication between services using Kafka
- JWT auth with role-based access (MANAGER, WAITER, KITCHEN_STAFF, SUPER_ADMIN) and OTP-based customer login
- WebSocket support for real-time order updates and KDS notifications
- Razorpay integration with webhook handling for online payments + support for cash workflows
- Redis caching with automatic invalidation for menu and category updates
- 12 Jest test suites covering major workflows across services
- Production-ready observability with Prometheus metrics and Grafana dashboards
- Local + production deployments supported via Docker Compose and Nginx reverse proxy