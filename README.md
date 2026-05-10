# 🛋️ DaVinci Furniture — E-Commerce tích hợp AI

Website bán đồ nội thất cao cấp với AI tìm kiếm ngữ nghĩa, tìm bằng ảnh, gợi ý sản phẩm cá nhân hoá và dự báo doanh thu.

**Tech Stack**

| Lớp | Công nghệ |
|-----|-----------|
| Frontend | React 18 + Vite + Tailwind CSS + Redux Toolkit |
| Backend | Node.js + Express + SQL Server |
| AI Service | Python 3.10+ + FastAPI + ChromaDB + Sentence-Transformers + PyTorch |

---

## ⚡ Khởi động nhanh

> Cần mở **3 terminal** song song.

**Terminal 1 — Backend (port 5000)**
```bash
cd backend
cp .env.example .env        # Điền DB, JWT, Cloudinary...
npm install
npm run dev
```

**Terminal 2 — Frontend (port 3000)**
```bash
cd frontend
npm install
npm run dev
```

**Terminal 3 — AI Service (port 8000)**
```bash
cd ai-service
cp .env.example .env        # Điền DB_PASSWORD, kiểm tra DB_SERVER

python -m venv venv
Windows: venv\Scripts\activate
pip install -r requirements.txt

# Cần Terminal 1 đang chạy trước:
python scripts/index_products.py      # Build index ChromaDB (Dense + BM25)
python scripts/train_recommender.py   # Train DL #3 NCF (Neural Collaborative Filtering)

python main.py
```

**Truy cập**

| Dịch vụ | URL |
|---------|-----|
| Website | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| AI Swagger UI | http://localhost:8000/docs |

---

## 🗂️ Cấu trúc dự án

```
btl-main/
├── README.md
├── setup.js                          # Cài đặt tự động (Node + Python)
├── setup-db.js                       # Khởi tạo database SQL Server
├── diagnose-db.js                    # Chẩn đoán kết nối
│
├── backend/                          # Node.js + Express — Port 5000
│   ├── .env.example
│   ├── package.json
│   ├── server.js                     # Entry point
│   ├── config/
│   │   ├── db.js                     # MSSQL connection pool
│   │   ├── db_optimized.js           # Queries tối ưu cho dashboard
│   │   ├── redis.js                  # Redis cache (fallback in-memory)
│   │   └── schema.sql                # DDL database schema
│   ├── controllers/                  # Business logic theo domain
│   ├── middleware/
│   │   ├── auth.js                   # JWT protect + role-based authorize
│   │   └── trackInteraction.js       # Ghi UserInteractions (dữ liệu cho AI)
│   ├── routes/
│   │   └── index.js                  # Mount tất cả routes + proxy tới AI
│   ├── services/
│   │   └── aiService.js              # HTTP client gọi Python AI Service
│   └── jobs/
│       └── retrainScheduler.js       # Cron retrain + endpoint admin trigger
│
├── frontend/                         # React + Vite — Port 3000
│   ├── package.json
│   ├── vite.config.js                # Proxy /api → :5000
│   └── src/
│       ├── components/
│       │   └── ai/                   # Widgets: Search, Recommend, Forecast
│       ├── pages/                    # HomePage, ProductDetail, Cart, Admin...
│       └── store/slices/aiSlice.js   # Redux slice cho AI state
│
└── ai-service/                       # Python + FastAPI — Port 8000
    ├── .env.example
    ├── requirements.txt
    ├── main.py                       # FastAPI entry + lifespan startup
    │
    ├── dl/                           # ── Deep Learning ──────────────────────
    │   ├── embedder.py               # DL #1  Sentence-Transformers multilingual
    │   ├── clip_encoder.py           # DL #2  CLIP ViT-B/32 (image + text)
    │   └── ncf_model.py              # DL #3  NCF — GMF + MLP (PyTorch)
    │
    ├── ir/                           # ── Information Retrieval ───────────────
    │   ├── dense.py                  # IR #1  Dense Retrieval — ChromaDB HNSW
    │   ├── bm25.py                   # IR #2  Sparse Retrieval — BM25 Okapi
    │   └── hybrid.py                 # IR #3  Hybrid — Reciprocal Rank Fusion
    │
    ├── models/                       # ── Forecasting & Query ─────────────────
    │   ├── query_processor.py        # Normalize + synonym expansion Việt/EN
    │   └── forecaster.py             # Prophet + LightGBM revenue forecasting
    │
    ├── routers/                      # ── API Endpoints ───────────────────────
    │   ├── search.py                 # /search/semantic  /search/hybrid
    │   ├── recommend.py              # /recommend/ncf/{user_id}  /recommend/status
    │   ├── image_search.py           # /image-search/*
    │   └── forecast.py               # /forecast/*
    │
    ├── scripts/                      # ── Utility Scripts ─────────────────────
    │   ├── index_products.py         # Build ChromaDB index từ backend API
    │   ├── train_recommender.py      # Train DL #3 NCF (GMF+MLP) từ SQL Server
    │   └── visualize_metrics.py      # Sinh 9 anh so sanh IR & DL (xem ben duoi)
    │
    ├── output/                       # Anh output cua visualize_metrics.py (9 anh)
    │   ├── 01_ir_feature_table.png   # Bang dac diem IR #1/#2/#3
    │   ├── 02_ir_eval_metrics.png    # Precision/Recall/NDCG/MRR
    │   ├── 03_bm25_runtime_scores.png
    │   ├── 04_dense_runtime_scores.png
    │   ├── 05_hybrid_rrf_scores.png
    │   ├── 06_dl_feature_table.png   # Bang dac diem DL #1/#2/#3
    │   ├── 07_ncf_heatmap.png        # NCF score matrix
    │   ├── 08_business_reranking.png # Breakdown business score
    │   └── 09_clip_pipeline.png      # CLIP image search flow
    │
    └── data/                         # Model artifacts
        ├── chroma_db/                # ChromaDB vector index
        └── ncf_model.pkl             # NCF model (sau khi chay train_recommender.py)
```

---

## 🤖 Kiến trúc AI

### Deep Learning (`dl/`)

| # | File | Model | Vai trò |
|---|------|-------|---------|
| DL #1 | `embedder.py` | `paraphrase-multilingual-MiniLM-L12-v2` | Encode query/product text → 384-dim dense vector |
| DL #2 | `clip_encoder.py` | CLIP `ViT-B/32` (OpenAI) | Encode ảnh + text → 512-dim cho image search |
| DL #3 | `ncf_model.py` | NCF: GMF + MLP (PyTorch) | Gợi ý cá nhân hoá qua neural collaborative filtering |

### Information Retrieval (`ir/`)

| # | File | Kỹ thuật | Vai trò |
|---|------|----------|---------|
| IR #1 | `dense.py` | ChromaDB HNSW, cosine similarity | ANN search trên không gian vector dày |
| IR #2 | `bm25.py` | BM25 Okapi (`rank-bm25`) | Exact keyword match — tên, thương hiệu, màu sắc |
| IR #3 | `hybrid.py` | Reciprocal Rank Fusion (RRF) | Kết hợp Dense + BM25 không cần chuẩn hoá score |

### Traditional ML (`models/`)

| File | Vai trò |
|------|---------|
| `query_processor.py` | Normalize query + synonym expansion Việt/EN trước khi tìm kiếm |
| `forecaster.py` | Dự báo doanh thu — Prophet → LightGBM → rolling avg |

### Luồng Hybrid Search

```
User query "ghe sofa da"
        │
        ▼
query_processor.py  →  normalize + synonym expand
        │
        ▼  "ghe sofa da chair sofa leather"
        │
        ├──────────────────────────┐
        ▼                          ▼
   DL #1 Sentence-Transformers   IR #2 BM25
   → 384-dim vector               → tokenize + score
        │                          │
        ▼                          │
   IR #1 ChromaDB HNSW             │
   → cosine ANN top-K              │
        │                          │
        └──────────┬───────────────┘
                   ▼
             IR #3 RRF Fusion
             k=60, dense_w=0.6, sparse_w=0.4
                   │
                   ▼
           Business Re-ranking
           0.65*semantic + 0.15*rating + 0.12*sold + 0.08*discount
                   │
                   ▼
              Top-N results
```

---

## 📊 Visualize IR & DL Metrics

Script sinh **9 ảnh PNG** riêng biệt, mỗi ảnh tập trung một khía cạnh của IR và DL:

```bash
cd ai-service
venv/scripts/activate 



# Dữ liệu thực (backend đang chạy + đã train model):
python scripts/visualize_metrics.py --live

# Chỉ định thư mục output:
python scripts/visualize_metrics.py --output-dir my_charts
```

**Output tại `ai-service/output/` — 9 ảnh:**

| File | Nội dung |
|------|---------|
| `01_ir_feature_table.png` | Bảng so sánh đặc điểm kỹ thuật IR #1 Dense / IR #2 BM25 / IR #3 Hybrid |
| `02_ir_eval_metrics.png` | Precision / Recall / NDCG / MRR @ K=3 cho cả 3 IR methods |
| `03_bm25_runtime_scores.png` | BM25 raw score Top-5 cho từng test query |
| `04_dense_runtime_scores.png` | Cosine similarity (= 1 − ChromaDB distance) Top-5 theo query |
| `05_hybrid_rrf_scores.png` | RRF fusion score Top-5 (hiển thị ×100 cho dễ đọc) |
| `06_dl_feature_table.png` | Bảng so sánh đặc điểm DL #1 Sent-Trans / DL #2 CLIP / DL #3 NCF |
| `07_ncf_heatmap.png` | NCF score matrix User × Product (dùng data thật sau khi train) |
| `08_business_reranking.png` | Breakdown 4 thành phần business score + bảng giá trị thực |
| `09_clip_pipeline.png` | Luồng hoạt động chi tiết của CLIP Image Search |

> **Quan trọng:**
> - **Dense (ảnh 04):** cần Sentence-Transformers load được từ HuggingFace. Nếu không, script tự fallback TF-IDF proxy và ghi chú lên ảnh.
> - **NCF heatmap (ảnh 07):** dùng `data/ncf_model.pkl` sau khi chạy `train_recommender.py`. Nếu chưa có, sinh mock với đúng kiến trúc GMF+MLP `hidden=[64,32,16]`.
> - Yêu cầu: `matplotlib`, `scikit-learn`, `rank-bm25`, `numpy`, `torch` — đã có trong `requirements.txt`.

---

## ⚙️ Cấu hình `.env`

### `backend/.env`

```env
DB_SERVER=localhost\SQLEXPRESS    # Dùng dấu \ (backslash) cho SQL Server Express
DB_NAME=DAVINCI_FURNITURE
DB_USER=sa
DB_PASSWORD=your_password
DB_PORT=1433

PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

JWT_SECRET=thay_bang_chuoi_random_toi_thieu_32_ky_tu
JWT_EXPIRES_IN=7d

AI_SERVICE_URL=http://localhost:8000

# Cloudinary (upload ảnh sản phẩm)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Redis (để trống = dùng in-memory fallback)
REDIS_URL=

# VNPay
VNPAY_TMNCODE=
VNPAY_HASHSECRET=
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:5000/api/payment/vnpay-return

# MoMo
MOMO_PARTNER_CODE=MOMO
MOMO_ACCESS_KEY=
MOMO_SECRET_KEY=
MOMO_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create
MOMO_RETURN_URL=http://localhost:3000/order-result
MOMO_NOTIFY_URL=http://localhost:5000/api/payment/momo-notify
```

### `ai-service/.env`

```env
BACKEND_URL=http://localhost:5000

# Database (dùng cho train_recommender.py)
DB_SERVER=localhost\SQLEXPRESS
DB_NAME=DAVINCI_FURNITURE
DB_USER=sa
DB_PASSWORD=your_password

# ChromaDB
CHROMA_PATH=./data/chroma_db

# Models
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
CLIP_MODEL=ViT-B-32
CLIP_PRETRAINED=openai

ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000
```

> ⚠️ SQL Server Express: phải dùng `localhost\SQLEXPRESS` (dấu `\` backslash). SQL Server thường thì chỉ cần `localhost`.

---

## 🗄️ Khởi tạo Database

**Cách 1 — Tự động:**
```bash
node setup-db.js
```

**Cách 2 — Thủ công trong SSMS:**
```sql
CREATE DATABASE DAVINCI_FURNITURE;
GO
-- Chạy file: backend/config/schema.sql
-- Chạy file: scripts/crawler/output_products.sql  (dữ liệu sản phẩm mẫu)
```

**Tạo tài khoản admin:**
```sql
UPDATE Users SET role = 'admin' WHERE email = 'your@email.com';
```

---

## 🔧 Setup AI Service — Chi tiết

### Lần đầu

```bash
cd ai-service
cp .env.example .env

python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Cần backend (Terminal 1) đang chạy:
python scripts/index_products.py            # Index text → ChromaDB
python scripts/index_products.py image      # Index ảnh (CLIP, cần GPU)
python scripts/train_recommender.py         # Train DL #3 NCF

python main.py
```

### Các lần sau

```bash
cd ai-service
source venv/bin/activate
python main.py    # Load model từ data/*.pkl, không cần train lại
```

### Retrain NCF

```bash
python scripts/train_recommender.py             # Train lại NCF (DL #3)
python scripts/train_recommender.py --dry-run   # Thử, không lưu file
```

---

## 📡 AI Endpoints

### Search

| Endpoint | Mô tả |
|----------|-------|
| `GET /api/ai/search/semantic?q=...` | Dense Retrieval (IR #1 + DL #1) + re-rank |
| `GET /api/ai/search/hybrid?q=...` | Dense + BM25 + RRF (IR #1+2+3) |
| `GET /api/ai/search/similar/{id}` | Sản phẩm tương tự qua vector |
| `GET /api/ai/search/autocomplete?q=...` | Gợi ý tên sản phẩm |

### Recommendation

| Endpoint | Mô tả |
|----------|-------|
| `GET /api/ai/recommend/ncf/{id}` | NCF cá nhân hoá (DL #3 — GMF + MLP) |
| `POST /api/ai/recommend/retrain` | Trigger retrain NCF trong background |
| `GET /api/ai/recommend/status` | Trạng thái NCF model |

### Image Search

| Endpoint | Mô tả |
|----------|-------|
| `POST /api/ai/image-search/by-image` | Upload ảnh → tìm sản phẩm tương tự (DL #2) |
| `GET /api/ai/image-search/by-text?q=...` | Mô tả bằng text → CLIP search |

### Forecast

| Endpoint | Mô tả |
|----------|-------|
| `GET /api/ai/forecast/revenue?horizon=30` | Dự báo doanh thu N ngày tới |
| `GET /api/ai/forecast/trending-products` | Sản phẩm đang tăng trưởng |
| `GET /api/ai/forecast/historical` | Tóm tắt lịch sử bán hàng |

---

## 🔄 Auto-Retrain

| Thời điểm | Hành động |
|-----------|-----------|
| 2:00 AM hàng ngày | Retrain NCF (DL #3) |
| 3:00 AM Chủ Nhật | Re-index sản phẩm vào ChromaDB |
| Sau mỗi đơn hàng | Trigger retrain bất đồng bộ |
| Thủ công | `POST /api/admin/ai/retrain` (yêu cầu quyền admin) |

---

## 🐛 Xử lý lỗi thường gặp

**Không kết nối được SQL Server**
```bash
node diagnose-db.js
# Kiểm tra DB_SERVER=localhost\SQLEXPRESS (dấu \, không phải /)
# Bật: SQL Server Browser service
# Bật: TCP/IP trong SQL Server Configuration Manager
```

**NCF chưa train / recommendation trả về rỗng**
```bash
cd ai-service && source venv/bin/activate
python scripts/train_recommender.py
curl http://localhost:8000/api/ai/recommend/status
```

**Vector index rỗng / tìm kiếm không ra kết quả**
```bash
# Đảm bảo backend đang chạy trước
python scripts/index_products.py
curl http://localhost:8000/health
```

**Port đang bị chiếm**
```bash
# macOS / Linux
lsof -ti :3000 | xargs kill -9
lsof -ti :5000 | xargs kill -9
lsof -ti :8000 | xargs kill -9

# Windows
netstat -ano | findstr :8000
taskkill /PID <pid> /F
```

**Redux state bị lỗi sau khi cập nhật code**
```js
// Chạy trong console trình duyệt:
localStorage.clear(); location.reload();
```

**Matplotlib lỗi khi chạy visualize_metrics.py**
```bash
pip install matplotlib scikit-learn --upgrade
# Nếu thiếu font:
sudo apt-get install fonts-noto   # Ubuntu/Debian
```
