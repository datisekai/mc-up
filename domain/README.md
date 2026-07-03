# domain/

Nghiệp vụ thuần — KHÔNG phụ thuộc hạ tầng (không import FastAPI, DB driver, SDK vendor).

- `ports.py` — interface cho mọi thứ bên ngoài (AD-2).
- Sắp có (theo epic): scoring rules (phần Xác), streak/XP, review lifecycle (ReviewRequest 72h — AD-6), entitlement (AD-8).

Quy tắc: domain không có mũi tên phụ thuộc ra ngoài. `api/` và `workers/` gọi domain; `adapters/` hiện thực port của domain.
