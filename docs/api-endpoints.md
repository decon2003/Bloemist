# API endpoints

The in-app views now read and write data through typed API routes. Requests accept and return JSON unless otherwise noted.

## Tasks
- `GET /api/tasks` — list all tasks. Response: `Task[]`.
- `POST /api/tasks` — create a task. Request body: `CreateTaskInput`. Response: created `Task`.
- `GET /api/tasks/:taskId` — fetch a single task. Response: `Task`.
- `PATCH /api/tasks/:taskId` — update a task (title, status, schedule, pricing, notes, photos). Request body: partial `CreateTaskInput`. Response: updated `Task`.
- `PATCH /api/tasks/:taskId/status` — update task status. Request body: `{ "status": TaskStatus }`. Response: updated `Task`.
- `PATCH /api/tasks/:taskId/notes` — update task notes. Request body: `{ "notes": string }`. Response: updated `Task`.
- `POST /api/tasks/:taskId/assign` — assign a task. Request body: `AssignTaskPayload`. Response: updated `Task`.
- `POST /api/tasks/:taskId/unassign` — clear assignment. Request body: `AssignTaskPayload`. Response: updated `Task`.
- `POST /api/tasks/:taskId/complete` — mark completed with proof image. Request form data: `photo` (`File|Blob`). Response: updated `Task` including `completionProofUrl`.

## Orders
- `GET /api/orders` — list all orders. Response: `Order[]`.
- `POST /api/orders` — create a new order. Request body: `CreateOrderInput`. Response: created `Order`.
- `GET /api/orders/:orderId` — fetch an order by id. Response: `Order`.

## Florists
- `GET /api/florists` — list available florists. Response: `Florist[]`.
