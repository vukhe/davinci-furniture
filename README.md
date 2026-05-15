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
python scripts/train_recommender.py   # Train DL #3 NCF

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
│   ├── controllers/
│   │   └── productController.js      # pageSize capped 48/page (thiết kế UX, không đổi)
│   ├── middleware/
│   │   ├── auth.js                   # JWT protect + role-based authorize
│   │   └── trackInteraction.js       # Ghi UserInteractions (dữ liệu cho AI)
│   ├── routes/
│   ├── services/
│   │   └── aiService.js              # HTTP client gọi Python AI Service
│   └── jobs/
│       └── retrainScheduler.js       # Cron retrain + endpoint admin trigger
│
├── frontend/                         # React + Vite — Port 3000
│
├── scripts/
│   └── crawler/                      # 🕷️ Multi-site furniture crawler
│       ├── README.md                 # Hướng dẫn đầy đủ crawler
│       ├── crawl_furniture.py        # Crawler chính (4 sites: blanc, hoaphat, hoaphat2, cdc)
│       ├── inspect_site.py           # Debug selector khi site thay đổi HTML
│       ├── output_products.json      # Data mẫu (133 SP)
│       ├── output_products.sql       # SQL import sẵn cho SSMS
│       └── requirements.txt
│
└── ai-service/                       # Python + FastAPI — Port 8000
    ├── requirements.txt
    ├── main.py
    │
    ├── dl/
    │   ├── embedder.py               # DL #1  Sentence-Transformers multilingual (384-dim)
    │   ├── clip_encoder.py           # DL #2  CLIP ViT-B/32 (512-dim, image+text)
    │   └── ncf_model.py              # DL #3  NCF — GMF + MLP (PyTorch)
    │
    ├── ir/
    │   ├── dense.py                  # IR #1  Dense Retrieval — ChromaDB HNSW
    │   ├── bm25.py                   # IR #2  BM25 Okapi ✅ [FIX-2: thêm description]
    │   └── hybrid.py                 # IR #3  Hybrid — Reciprocal Rank Fusion
    │
    ├── models/
    │   ├── query_processor.py        # Normalize + synonym expansion Việt/EN
    │   └── forecaster.py             # Prophet + LightGBM revenue forecasting
    │
    ├── routers/
    │   ├── search.py                 # /search/semantic  /search/hybrid ✅ [FIX-4: dynamic sold]
    │   ├── recommend.py              # /recommend/ncf/{user_id}
    │   ├── image_search.py           # /image-search/*
    │   └── forecast.py               # /forecast/*
    │
    ├── scripts/
    │   ├── index_products.py         # Build ChromaDB index (có pagination, lấy đủ toàn bộ SP)
    │   ├── train_recommender.py      # Train NCF từ SQL Server trực tiếp
    │   └── visualize_metrics.py      # 9 ảnh PNG so sánh IR & DL
    │                                 # ✅ [FIX-1: fetch pagination] [FIX-3: dynamic sold]
    │
    ├── output/                       # 9 ảnh PNG output
    └── data/
        ├── chroma_db/                # ChromaDB vector index
        └── ncf_model.pkl             # NCF model artifacts
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
| IR #2 | `bm25.py` | BM25 Okapi (`rank-bm25`) | Exact keyword match — tên, mô tả, thương hiệu, màu |
| IR #3 | `hybrid.py` | Reciprocal Rank Fusion (RRF) | Kết hợp Dense + BM25 không cần chuẩn hoá score |

### Luồng Hybrid Search

```
User query "ghe sofa da"
        │
        ▼
query_processor.py  →  normalize + synonym expand
        │
        ├──────────────────────────┐
        ▼                          ▼
   DL #1 Sentence-Transformers   IR #2 BM25
   → 384-dim vector               → tokenize + score
        │                          │
        ▼                          │
   IR #1 ChromaDB HNSW             │
   → cosine ANN top-K              │
        └──────────┬───────────────┘
                   ▼
             IR #3 RRF Fusion
             k=60, dense_w=0.6, sparse_w=0.4
                   │
                   ▼
           Business Re-ranking
           0.65*semantic + 0.15*(rating/5)
           + 0.12*(sold/max_sold) + 0.08*discount
                   │
                   ▼
              Top-N results
```

---

## 📊 Visualize IR & DL Metrics

```bash
cd ai-service
Windows: venv\Scripts\activate
# mac: source venv/bin/activate

# Mock data (không cần backend — 10 SP mẫu):
python scripts/visualize_metrics.py

# Dữ liệu thực (backend phải đang chạy):
python scripts/visualize_metrics.py --live --output-dir output
```



**9 ảnh output:**

| File | Nội dung |
|------|---------|
| `01_ir_feature_table.png` | So sánh đặc điểm kỹ thuật IR #1/#2/#3 |
| `02_ir_eval_metrics.png` | Precision / Recall / NDCG / MRR @ K=3 |
| `03_bm25_runtime_scores.png` | BM25 raw score Top-5 theo query |
| `04_dense_runtime_scores.png` | Cosine similarity Top-5 theo query |
| `05_hybrid_rrf_scores.png` | RRF fusion score Top-5 |
| `06_dl_feature_table.png` | So sánh đặc điểm DL #1/#2/#3 |
| `07_ncf_heatmap.png` | NCF score matrix User × Product |
| `08_business_reranking.png` | Breakdown 4 thành phần business score |
| `09_clip_pipeline.png` | Luồng CLIP Image Search |

.

---

## 🕷️ Crawler — Thêm dữ liệu thật

NCF cần ít nhất **2000 interactions từ 200 user thật** để đạt Hit Rate@10 ≥ 0.7. Crawler sinh thêm sản phẩm và interaction giả làm nền:

```bash
cd scripts/crawler
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt

# Crawl tất cả 4 sites (mặc định tối đa 3000 SP):
python crawl_furniture.py

# Crawl từng site riêng:
python crawl_furniture.py --site blanc
python crawl_furniture.py --site hoaphat

# Tiếp tục nếu bị ngắt:
python crawl_furniture.py --resume
```

Sau đó mở `output_products.sql` trong SSMS → F5, rồi:

```bash
cd ../../ai-service
python scripts/index_products.py          # Re-index toàn bộ
python scripts/train_recommender.py       # Retrain NCF
```

> Xem chi tiết tại `scripts/crawler/README.md`.

---

## ⚙️ Cấu hình `.env`

### `backend/.env`

```env
DB_SERVER=localhost\SQLEXPRESS
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

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
REDIS_URL=

VNPAY_TMNCODE=
VNPAY_HASHSECRET=
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:5000/api/payment/vnpay-return

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

DB_SERVER=localhost\SQLEXPRESS
DB_NAME=DAVINCI_FURNITURE
DB_USER=sa
DB_PASSWORD=your_password

CHROMA_PATH=./data/chroma_db
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
CLIP_MODEL=ViT-B-32
CLIP_PRETRAINED=openai

ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000
```

---

## 🗄️ Khởi tạo Database

```bash
# Tự động:
node setup-db.js

# Thủ công trong SSMS:
# 1. Chạy backend/config/schema.sql
# 2. Chạy scripts/crawler/output_products.sql

# Tạo admin:
UPDATE Users SET role = 'admin' WHERE email = 'your@email.com';
```

---

## 📡 AI Endpoints

| Endpoint | Mô tả |
|----------|-------|
| `GET /api/ai/search/semantic?q=` | Dense Retrieval + business re-rank |
| `GET /api/ai/search/hybrid?q=` | Dense + BM25 + RRF |
| `GET /api/ai/search/similar/{id}` | Sản phẩm tương tự |
| `GET /api/ai/search/autocomplete?q=` | Gợi ý tên |
| `GET /api/ai/recommend/ncf/{id}` | NCF cá nhân hoá |
| `POST /api/ai/recommend/retrain` | Trigger retrain NCF |
| `GET /api/ai/recommend/status` | Trạng thái model |
| `POST /api/ai/image-search/by-image` | Upload ảnh → tìm SP tương tự |
| `GET /api/ai/image-search/by-text?q=` | Text → CLIP search |
| `GET /api/ai/forecast/revenue?horizon=30` | Dự báo doanh thu |
| `GET /api/ai/forecast/trending-products` | SP đang tăng trưởng |

---

## 🔄 Auto-Retrain

| Thời điểm | Hành động |
|-----------|-----------|
| 2:00 AM hàng ngày | Retrain NCF |
| 3:00 AM Chủ Nhật | Re-index ChromaDB |
| Sau mỗi đơn hàng | Trigger retrain async |
| Thủ công | `POST /api/admin/ai/retrain` (admin) |

---

## 🐛 Xử lý lỗi thường gặp

**Không kết nối SQL Server**
```bash
node diagnose-db.js
# Kiểm tra: DB_SERVER dùng \ (backslash)
# Bật SQL Server Browser + TCP/IP trong SQL Server Configuration Manager
```

**NCF train được ít sản phẩm hơn dự kiến**
```bash
# Nguyên nhân: ít user tương tác với sản phẩm đủ min_interactions lần
# Giải pháp: giảm ngưỡng
python scripts/train_recommender.py --min-interactions 1
# Hoặc crawl thêm data để có nhiều interaction hơn
```

**Dense/visualize dùng TF-IDF thay Sentence-Transformers**
```bash
pip install sentence-transformers --upgrade
python -c "from sentence_transformers import SentenceTransformer; print(SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2').get_sentence_embedding_dimension())"
# Phải in ra: 384
```

**Vector index rỗng**
```bash
python scripts/index_products.py   # Đảm bảo backend đang chạy trước
curl http://localhost:8000/health
```

**Port bị chiếm**
```bash
# Linux/macOS:
lsof -ti :8000 | xargs kill -9
# Windows:
netstat -ano | findstr :8000 && taskkill /PID <pid> /F
```

---

## 📝 Changelog

### v1.1 — AI fixes

| # | File đã sửa | Nội dung thay đổi |
|---|-------------|-------------------|
| FIX-1 | `scripts/visualize_metrics.py` | `fetch_products()`: thêm vòng lặp pagination — trước chỉ lấy page 1 (48 SP), giờ lấy đủ toàn catalog (692 SP = 15 pages). Metrics được tính trên toàn bộ data thay vì 6.9% |
| FIX-2 | `ir/bm25.py` | `_product_to_doc()`: thêm field `description` (truncate 300 ký tự); tăng name weight từ ×2 lên ×3. BM25 match được nội dung mô tả, cải thiện NDCG ước tính +0.08–0.15 |
| FIX-3 | `scripts/visualize_metrics.py` | `make_08()`: đồng bộ `sold / max_sold` động với `search.py` để biểu đồ breakdown business score khớp logic thực tế |
| FIX-4 | `routers/search.py` | `rerank()`: thay `sold / 500.0` hardcode bằng `sold / max_sold` tính từ kết quả query. Tránh component sold quá nhỏ khi catalog mới ít sản phẩm bán được |

> **Không thay đổi** `backend/controllers/productController.js`: giới hạn 48 SP/page là thiết kế cố ý cho pagination UX. Các script AI tự xử lý bằng cách paginate qua tất cả pages.
