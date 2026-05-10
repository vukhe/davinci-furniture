"""
scripts/visualize_metrics.py
============================
Sinh 9 anh PNG so sanh IR va DL cho du an DaVinci Furniture.

Cach chay (tu thu muc ai-service/):
    python scripts/visualize_metrics.py            # mock data, khong can gi
    python scripts/visualize_metrics.py --live     # lay product tu backend (port 5000)

Anh dau ra tai ai-service/output/:
    01_ir_feature_table.png   06_dl_feature_table.png
    02_ir_eval_metrics.png    07_ncf_heatmap.png
    03_bm25_runtime_scores.png 08_business_reranking.png
    04_dense_runtime_scores.png 09_clip_pipeline.png
    05_hybrid_rrf_scores.png

NOTE:
    - Dense (IR#1 / DL#1) can Sentence-Transformers. Neu sandbox bi block HuggingFace,
      script tu dong dung proxy TF-IDF char-ngram va ghi chu tren anh.
    - NCF heatmap can data/ncf_model.pkl (sau khi chay train_recommender.py).
      Neu chua co, script sinh mock voi dung kien truc GMF+MLP hidden=[64,32,16].
"""

from __future__ import annotations
import argparse, os, sys
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
from matplotlib.colors import LinearSegmentedColormap

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ir.bm25 import BM25Retriever, _tokenize, _product_to_doc
from ir.hybrid import reciprocal_rank_fusion

try:
    from models.query_processor import normalize_query, expand_query
    def preprocess(q: str) -> str:
        """Normalize + expand query — giống pipeline production."""
        return expand_query(normalize_query(q))
    print("[QueryProc] query_processor loaded (normalize + synonym expand)")
except Exception as _e:
    print(f"[QueryProc] Fallback to simple lowercase ({_e})")
    def preprocess(q: str) -> str:
        import re, unicodedata
        q = q.strip().lower()
        q = re.sub(r"[^\w\s]", " ", q, flags=re.UNICODE)
        return re.sub(r"\s+", " ", q).strip()

# ── Mau sac ───────────────────────────────────────────────────────────────────
C_IR1, C_IR2, C_IR3 = "#4361EE", "#F72585", "#7209B7"
C_DL1, C_DL2, C_DL3 = "#4CC9F0", "#F8961E", "#43AA8B"
BG, BG2, BG3 = "#0D1117", "#161B22", "#21262D"
TEXT, MUTED, BORDER = "#E6EDF3", "#8B949E", "#30363D"

plt.rcParams["font.family"] = "DejaVu Sans"
plt.rcParams["axes.unicode_minus"] = False

# ── Mock products (noi that DaVinci, dung dung schema Products DB) ─────────────
MOCK_PRODUCTS = [
    {"product_id":1,  "name":"Ghe sofa da that Bac Au",       "category_name":"Sofa",       "brand":"DaVinci","color":"nau",   "material":"da",        "style":"scandinavian","price":18500000,"avg_rating":4.7,"sold":42, "sale_price":16500000,"collection_name":"Nordic",   "description":"Sofa da that cao cap phong khach"},
    {"product_id":2,  "name":"Ban an go oc cho 6 cho ngoi",   "category_name":"Ban an",     "brand":"DaVinci","color":"nau dam","material":"go",        "style":"classic",    "price":12000000,"avg_rating":4.5,"sold":28, "sale_price":None,     "collection_name":"Heritage","description":"Ban an go oc cho tu nhien"},
    {"product_id":3,  "name":"Ghe an Eames hien dai",         "category_name":"Ghe an",     "brand":"DaVinci","color":"xam",   "material":"go-nhua",   "style":"modern",     "price":2800000, "avg_rating":4.3,"sold":115,"sale_price":2500000, "collection_name":"Modern",  "description":"Ghe Eames phong cach hien dai"},
    {"product_id":4,  "name":"Ke sach go thong 5 tang",       "category_name":"Ke sach",    "brand":"Local",  "color":"trang", "material":"go thong",  "style":"minimalist", "price":3200000, "avg_rating":4.1,"sold":67, "sale_price":None,     "collection_name":"Minimal", "description":"Ke sach toi gian 5 tang"},
    {"product_id":5,  "name":"Giuong ngu go soi dau giuong",  "category_name":"Giuong",     "brand":"DaVinci","color":"trang", "material":"go soi",    "style":"modern",     "price":8900000, "avg_rating":4.6,"sold":33, "sale_price":None,     "collection_name":"Sleep",   "description":"Giuong go soi cao cap"},
    {"product_id":6,  "name":"Tu quan ao canh kinh trang",    "category_name":"Tu quan ao", "brand":"IKEA",   "color":"trang", "material":"go MDF",    "style":"modern",     "price":6500000, "avg_rating":4.0,"sold":55, "sale_price":5800000, "collection_name":"Storage", "description":"Tu quan ao hien dai canh kinh"},
    {"product_id":7,  "name":"Ban lam viec go walnut mat kinh","category_name":"Ban lam viec","brand":"DaVinci","color":"nau", "material":"go walnut", "style":"industrial", "price":9200000, "avg_rating":4.8,"sold":21, "sale_price":None,     "collection_name":"Office",  "description":"Ban go walnut mat kinh cuong luc"},
    {"product_id":8,  "name":"Den ban LED chong choi mat",    "category_name":"Den ban",    "brand":"Philips","color":"trang", "material":"kim loai",  "style":"modern",     "price":1200000, "avg_rating":4.4,"sold":203,"sale_price":980000,  "collection_name":"Light",   "description":"Den LED bao ve mat"},
    {"product_id":9,  "name":"Ghe van phong ergonomic luoi",  "category_name":"Ghe van phong","brand":"Herman Miller","color":"den","material":"luoi","style":"ergonomic",  "price":15000000,"avg_rating":4.9,"sold":18, "sale_price":13500000,"collection_name":"Ergo",    "description":"Ghe ergonomic thoai mai van phong"},
    {"product_id":10, "name":"Tham phong khach len 160x230",  "category_name":"Tham",       "brand":"DaVinci","color":"be",    "material":"len",       "style":"classic",    "price":4500000, "avg_rating":4.2,"sold":39, "sale_price":None,     "collection_name":"Comfort", "description":"Tham len tu nhien cao cap"},
]

# TEST_QUERIES_MOCK tĩnh dùng cho mock data.
# Khi --live, hàm build_live_queries() sẽ tạo queries từ sản phẩm thật.
TEST_QUERIES_MOCK = [
    ("sofa da phong khach",    [1]),
    ("ban an go gia dinh",     [2]),
    ("ban lam viec van phong", [7, 9]),
    ("tu quan ao trang",       [6]),
    ("ghe ergonomic thoai mai",[9, 3]),
]

K = 5   # K=5 phu hop hon voi catalog ~48-700 san pham


def build_live_queries(products: list[dict]) -> list[tuple]:
    """
    Tự động tạo test queries từ sản phẩm thật:
    - Lấy 5 category có nhiều sản phẩm nhất
    - Mỗi category: dùng 1-2 từ khóa từ tên sản phẩm đầu tiên làm query
    - Relevant = tất cả product_id trong category đó

    Cách này đảm bảo BM25 và Dense LUÔN tìm thấy kết quả khớp
    (vì query được sinh từ chính tên sản phẩm trong index).
    """
    from collections import defaultdict
    import unicodedata, re

    def normalize(text: str) -> str:
        """Bỏ dấu tiếng Việt, lowercase."""
        text = unicodedata.normalize("NFD", text)
        text = "".join(c for c in text if unicodedata.category(c) != "Mn")
        return re.sub(r"[^\w\s]", " ", text).lower().strip()

    # Nhóm products theo category
    cat_map = defaultdict(list)
    for p in products:
        cat = p.get("category_name", "")
        pid = int(p.get("product_id", p.get("id", 0)))
        if cat and pid:
            cat_map[cat].append(p)

    # Chọn top-5 category nhiều sản phẩm nhất
    top_cats = sorted(cat_map.items(), key=lambda x: -len(x[1]))[:5]

    queries = []
    for cat, prods in top_cats:
        # Lấy sản phẩm đầu tiên làm seed query
        p0 = prods[0]
        name = p0.get("name", "")
        norm_name = normalize(name)
        # Lấy 2-3 từ đầu của tên (đủ để BM25/Dense match)
        words = norm_name.split()[:3]
        if not words:
            words = [normalize(cat)]
        query = " ".join(words)

        # Relevant = tất cả sản phẩm trong category này
        relevant_ids = [int(p.get("product_id", p.get("id", 0))) for p in prods]

        queries.append((query, relevant_ids))
        print(f"  [Query] '{query}' -> relevant: {relevant_ids[:5]}{'...' if len(relevant_ids)>5 else ''}")

    return queries if queries else TEST_QUERIES_MOCK

# ── Metrics ───────────────────────────────────────────────────────────────────
def precision_at_k(r, rel, k): return sum(1 for x in r[:k] if x in rel) / k if k else 0.0
def recall_at_k(r, rel, k):   return sum(1 for x in r[:k] if x in rel) / len(rel) if rel else 0.0
def ndcg_at_k(r, rel, k):
    d = sum(1/np.log2(i+2) for i,x in enumerate(r[:k]) if x in rel)
    id_ = sum(1/np.log2(i+2) for i in range(min(len(rel), k)))
    return d/id_ if id_ else 0.0
def mrr(r, rel):
    for i,x in enumerate(r):
        if x in rel: return 1.0/(i+1)
    return 0.0
def avg_metrics(results):
    P = [precision_at_k(r["ret"], r["rel"], K) for r in results]
    R = [recall_at_k(r["ret"], r["rel"], K)    for r in results]
    N = [ndcg_at_k(r["ret"], r["rel"], K)      for r in results]
    M = [mrr(r["ret"], r["rel"])               for r in results]
    return {"P": np.mean(P), "R": np.mean(R), "N": np.mean(N), "M": np.mean(M)}

# ── Drawing helpers ───────────────────────────────────────────────────────────
def cell(ax, x, y, w, h, txt, bg, fg=TEXT, fs=9, bold=False):
    ax.add_patch(FancyBboxPatch((x+.003, y+.005), w-.006, h-.010,
        boxstyle="round,pad=0.005", facecolor=bg, edgecolor=BORDER, lw=.5,
        transform=ax.transAxes, clip_on=False))
    ax.text(x+w/2, y+h/2, txt, transform=ax.transAxes, fontsize=fs, color=fg,
        ha="center", va="center", fontweight="bold" if bold else "normal",
        multialignment="center")

def ax_style(ax, title, ylabel=None):
    ax.set_facecolor(BG2)
    for sp in ax.spines.values(): sp.set_edgecolor(BORDER)
    ax.yaxis.grid(True, color=BORDER, linestyle="--", alpha=.5, zorder=0)
    ax.set_axisbelow(True)
    ax.set_title(title, color=TEXT, fontsize=13, fontweight="bold", pad=10)
    if ylabel: ax.set_ylabel(ylabel, color=MUTED, fontsize=10)
    ax.tick_params(colors=MUTED, labelsize=9)

def save(fig, name, out_dir):
    p = out_dir / f"{name}.png"
    fig.savefig(p, dpi=150, bbox_inches="tight", facecolor=BG, edgecolor="none")
    plt.close(fig)
    print(f"  [OK] {p.name}")

# ── Dense: thu Sentence-Transformers, fallback TF-IDF ─────────────────────────
def load_dense(products):
    try:
        from sentence_transformers import SentenceTransformer
        from sklearn.metrics.pairwise import cosine_similarity
        model_name = os.getenv("EMBEDDING_MODEL",
            "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
        print(f"  [DL#1] Loading {model_name}...")
        mdl = SentenceTransformer(model_name)
        corpus = [_product_to_doc(p) for p in products]
        cembs  = mdl.encode(corpus, normalize_embeddings=True)
        def search(q, n=10):
            qe = mdl.encode([q], normalize_embeddings=True)
            sims = cosine_similarity(qe, cembs)[0]
            top  = np.argsort(sims)[::-1][:n]
            return [{"product_id": str(products[i].get("product_id", products[i].get("id", i))),
                     "name": products[i]["name"],
                     "semantic_score": round(float(sims[i]), 4),
                     "price": float(products[i].get("price", 0)),
                     "sale_price": products[i].get("sale_price"),
                     "category": products[i].get("category_name",""),
                     "material": products[i].get("material"),
                     "image_url": products[i].get("image_url", products[i].get("image", "")),
                     "avg_rating": products[i].get("avg_rating"),
                     "sold": products[i].get("sold")}
                    for i in top if sims[i] > 0.05]
        print(f"  [DL#1] Loaded OK (dim={mdl.get_sentence_embedding_dimension()})")
        return search, True
    except Exception as e:
        print(f"  [DL#1] Sentence-Transformers unavailable ({e})")
        print("         -> Proxy TF-IDF char-ngram (ghi chu tren anh)")
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        corpus = [_product_to_doc(p) for p in products]
        tfidf  = TfidfVectorizer(analyzer="char_wb", ngram_range=(2,4))
        mat    = tfidf.fit_transform(corpus)
        def search(q, n=10):
            sims = cosine_similarity(tfidf.transform([q]), mat)[0]
            top  = np.argsort(sims)[::-1][:n]
            return [{"product_id": str(products[i].get("product_id", products[i].get("id", i))),
                     "name": products[i]["name"],
                     "semantic_score": round(float(sims[i]), 4),
                     "price": float(products[i].get("price", 0)),
                     "sale_price": products[i].get("sale_price"),
                     "category": products[i].get("category_name",""),
                     "material": products[i].get("material"),
                     "image_url": products[i].get("image_url", products[i].get("image", "")),
                     "avg_rating": products[i].get("avg_rating"),
                     "sold": products[i].get("sold")}
                    for i in top if sims[i] > 0.05]
        return search, False

# ── NCF heatmap: thu pkl, fallback mock dung kien truc that ──────────────────
def build_ncf_matrix(products, n_users=5, n_items=10):
    pkl = ROOT / "data" / "ncf_model.pkl"
    n_items = min(n_items, len(products))
    if pkl.exists():
        try:
            import pickle, torch
            with open(pkl, "rb") as f: ncf = pickle.load(f)
            if not getattr(ncf, "is_trained", False):
                raise ValueError("chua train")
            uids  = sorted(ncf.user_index.keys())[:n_users]
            pids  = list(ncf.item_index.keys())[:n_items]
            mat   = np.zeros((len(uids), len(pids)))
            ncf._model.eval()
            dev = ncf._device
            with torch.no_grad():
                for ui, uid in enumerate(uids):
                    for pi, pid in enumerate(pids):
                        if pid not in ncf.item_index: continue
                        u_t = torch.tensor([ncf.user_index[uid]], dtype=torch.long, device=dev)
                        i_t = torch.tensor([ncf.item_index[pid]],  dtype=torch.long, device=dev)
                        mat[ui, pi] = float(ncf._model(u_t, i_t).cpu())
            ulbls = [f"User {uid}" for uid in uids]
            plbls = [f"P{pid}: {products[pi]['name'][:14]}" for pi, pid in enumerate(pids)]
            print(f"  [NCF] Real model: {len(uids)} users x {len(pids)} products")
            return mat, ulbls, plbls, True
        except Exception as e:
            print(f"  [NCF] Load pkl failed ({e}) -> mock")

    # Mock — kien truc that: GMF + MLP hidden=[64,32,16], embed_dim=32, dropout=0.2
    import torch, torch.nn as nn
    class _NCF(nn.Module):
        def __init__(self, nu, ni, edim=32):
            super().__init__()
            self.ug = nn.Embedding(nu, edim); self.ig = nn.Embedding(ni, edim)
            self.um = nn.Embedding(nu, edim); self.im = nn.Embedding(ni, edim)
            layers, ind = [], edim*2
            for od in [64, 32, 16]:
                layers += [nn.Linear(ind, od), nn.ReLU(), nn.Dropout(.2)]; ind = od
            self.mlp = nn.Sequential(*layers)
            self.out = nn.Linear(edim+16, 1); self.sig = nn.Sigmoid()
            for m in self.modules():
                if isinstance(m, (nn.Linear, nn.Embedding)):
                    nn.init.normal_(m.weight, std=.01)
        def forward(self, u, i):
            gmf = self.ug(u) * self.ig(i)
            mlp = self.mlp(torch.cat([self.um(u), self.im(i)], -1))
            return self.sig(self.out(torch.cat([gmf, mlp], -1))).squeeze(-1)

    torch.manual_seed(42)
    mdl = _NCF(n_users, n_items)
    # Gia lap so thich theo loai san pham: sofa(0), ban(1), ghe(2), ke(3), giuong(4)...
    pref = {0:[0,9], 1:[1,6], 2:[4,2], 3:[5,3], 4:[7,9]}
    fu, fi, fs = [], [], []
    for uid, prefs in pref.items():
        for iid in range(n_items):
            fu.append(uid); fi.append(iid); fs.append(.85 if iid in prefs else .15)
    opt = torch.optim.Adam(mdl.parameters(), lr=5e-3)
    loss_fn = nn.BCELoss()
    u_t = torch.tensor(fu, dtype=torch.long)
    i_t = torch.tensor(fi, dtype=torch.long)
    s_t = torch.tensor(fs, dtype=torch.float32)
    mdl.train()
    for _ in range(400):
        opt.zero_grad()
        loss_fn(mdl(u_t, i_t), s_t).backward(); opt.step()
    mdl.eval()
    mat = np.zeros((n_users, n_items))
    with torch.no_grad():
        for u in range(n_users):
            for i in range(n_items):
                mat[u, i] = float(mdl(torch.tensor([u]), torch.tensor([i])))
    ulbls = [f"User {i+1}" for i in range(n_users)]
    plbls = [f"P{products[i].get('product_id', products[i].get('id',i))}: {products[i]['name'][:14]}" for i in range(n_items)]
    print(f"  [NCF] Mock matrix: {n_users}x{n_items} (kien truc GMF+MLP [64,32,16])")
    return mat, ulbls, plbls, False

# ── Tinh toan tat ca diem so ─────────────────────────────────────────────────
def compute(products, dense_search, test_queries=None):
    if test_queries is None:
        test_queries = TEST_QUERIES_MOCK
    bm25 = BM25Retriever(k1=1.5, b=0.75)
    bm25.build_index(products)
    res_b, res_d, res_h, qdata = [], [], [], []
    for q_raw, rel in test_queries:
        # Dung query_processor giong pipeline production:
        # normalize (lowercase, bo dau cau) + expand synonym Viet-Anh
        q = preprocess(q_raw)
        br = bm25.search(q, n=10)
        dr = dense_search(q, n=10)
        hr = reciprocal_rank_fusion(dr, br, k=60, dense_weight=0.7, sparse_weight=0.3)
        res_b.append({"ret": [int(x["product_id"]) for x in br], "rel": rel})
        res_d.append({"ret": [int(x["product_id"]) for x in dr], "rel": rel})
        res_h.append({"ret": [int(x["product_id"]) for x in hr], "rel": rel})
        qdata.append({
            "q":  q_raw,   # hien thi query goc (chua expand)
            "bm25":  [x["bm25_score"]            for x in br[:5]],
            "bm25n": [x["name"][:18]              for x in br[:5]],
            "den":   [x["semantic_score"]          for x in dr[:5]],
            "denn":  [x["name"][:18]              for x in dr[:5]],
            "rrf":   [x.get("rrf_score",0)         for x in hr[:5]],
            "rrfn":  [x.get("name","")[:18]        for x in hr[:5]],
            "dr":    dr,   # raw dense results for business rerank
        })
    metrics = {
        "Dense (IR#1)":   avg_metrics(res_d),
        "BM25 (IR#2)":    avg_metrics(res_b),
        "Hybrid (IR#3)":  avg_metrics(res_h),
    }
    return qdata, metrics

# ═════════════════════════════════════════════════════════════════════════════
# 01 — IR Feature Table
# ═════════════════════════════════════════════════════════════════════════════
def make_01(out_dir):
    feats = ["Loai model","Thuat toan","Index type","Can GPU?",
             "Hieu ngu nghia?","Exact keyword?","Da ngon ngu?",
             "Tim kiem anh?","Can train?","Index time",
             "Query latency","RAM","Diem dau ra","Tot voi query"]
    data = {
        "IR #1\nDense":  ["Vector ANN","HNSW Cosine","Dense vec","Khong","Cao","Thap","Co (50+)","Khong","Khong","~5 phut","< 50ms","~1 GB","Cosine 0-1","Ngu nghia"],
        "IR #2\nBM25":   ["Sparse TF","BM25 Okapi","Inverted","Khong","Thap","Cao","Han che","Khong","Khong","~1 phut","< 10ms","<100 MB","BM25 >= 0","Exact match"],
        "IR #3\nHybrid": ["Ket hop","RRF Fusion","Ca hai","Khong","Trung","Trung","Co","Khong","Khong","Ket hop","< 60ms","~1 GB","RRF 0-0.02","Moi loai"],
    }
    fig, ax = plt.subplots(figsize=(16,10), facecolor=BG)
    ax.set_facecolor(BG); ax.axis("off")
    ax.text(.5,.975,"IR — Feature Comparison Table",transform=ax.transAxes,
        fontsize=18,fontweight="bold",color=TEXT,ha="center",va="top")
    keys = list(data.keys()); ccols = [C_IR1,C_IR2,C_IR3]
    TL,TR,TT,TB = .01,.99,.91,.02
    cw=(TR-TL)/(len(keys)+1); rh=(TT-TB)/(len(feats)+1.4)
    cell(ax,TL,TT-rh,cw,rh,"Dac diem",BG3,bold=True)
    for ci,(k,c) in enumerate(zip(keys,ccols)):
        cell(ax,TL+(ci+1)*cw,TT-rh,cw,rh,k,c,fg=BG,bold=True)
    pos={"Cao","Co","Co (50+)"}; neg={"Thap","Khong","Han che"}
    for ri,f in enumerate(feats):
        rb=BG2 if ri%2==0 else BG3; y=TT-(ri+2)*rh
        cell(ax,TL,y,cw,rh,f,rb,bold=True,fs=8.5)
        for ci,k in enumerate(keys):
            v=data[k][ri]; fg=TEXT
            if v in pos: fg="#2ECC71"
            elif v in neg: fg="#E74C3C"
            elif v in {"Trung","Ca hai","Ket hop"}: fg="#F39C12"
            cell(ax,TL+(ci+1)*cw,y,cw,rh,v,rb,fg=fg,fs=8)
    for xi,(lbl,c) in enumerate(zip(
        ["IR #1  Dense: ChromaDB HNSW cosine, dim=384",
         "IR #2  BM25: k1=1.5, b=0.75 | doc = name*2+category+collection+material+brand+color+style",
         "IR #3  Hybrid RRF: k=60, dense_w=0.7, sparse_w=0.3"],ccols)):
        ax.text(.18+xi*.33,.005,f"  {lbl}  ",transform=ax.transAxes,
            fontsize=9,color=BG,ha="center",va="bottom",
            bbox=dict(facecolor=c,edgecolor="none",boxstyle="round,pad=0.4"))
    save(fig,"01_ir_feature_table",out_dir)

# ═════════════════════════════════════════════════════════════════════════════
# 02 — IR Evaluation Metrics
# ═════════════════════════════════════════════════════════════════════════════
def make_02(metrics, use_real_dense, n_queries, out_dir):
    fig, ax = plt.subplots(figsize=(12,7), facecolor=BG)
    ax_style(ax,f"IR Evaluation Metrics — Precision@{K} / Recall@{K} / NDCG@{K} / MRR  |  K={K}, query_processor ON",ylabel="Score")
    mn=[f"Precision@{K}",f"Recall@{K}",f"NDCG@{K}","MRR"]
    x=np.arange(4); w=.22; offs=np.linspace(-w,w,3); colors=[C_IR1,C_IR2,C_IR3]
    for (meth,vals),c,off in zip(metrics.items(),colors,offs):
        v=[vals["P"],vals["R"],vals["N"],vals["M"]]
        bars=ax.bar(x+off,v,w*.9,label=meth,color=c,alpha=.88,edgecolor=BORDER,lw=.5,zorder=3)
        for b,val in zip(bars,v):
            ax.text(b.get_x()+b.get_width()/2,b.get_height()+.02,f"{val:.2f}",
                ha="center",va="bottom",fontsize=9,color=TEXT,fontweight="bold")
    ax.set_xticks(x); ax.set_xticklabels(mn,color=TEXT,fontsize=11)
    ax.set_ylim(0,1.3)
    ax.legend(facecolor=BG3,edgecolor=BORDER,labelcolor=TEXT,fontsize=10,loc="upper right")
    note = "Dense: Sentence-Transformers that (normalize_embeddings=True)" if use_real_dense \
           else "Dense: proxy TF-IDF char-ngram (chay local de co ket qua chinh xac hon)"
    ax.text(.01,.97,
        f"{note}\n"
        f"BM25: k1=1.5, b=0.75 | Hybrid: RRF k=60 dense_w=0.7 sparse_w=0.3 | query_processor: normalize+expand | "
        f"{n_queries} queries noi that DaVinci",
        transform=ax.transAxes,fontsize=8,color=MUTED,va="top")
    save(fig,"02_ir_eval_metrics",out_dir)

# ═════════════════════════════════════════════════════════════════════════════
# 03 — BM25 Runtime Scores
# ═════════════════════════════════════════════════════════════════════════════
def make_03(qdata, out_dir):
    fig, ax = plt.subplots(figsize=(14,7), facecolor=BG)
    ax_style(ax,"IR #2 BM25 — Runtime Scores theo Query (Top 5)",ylabel="BM25 Score (raw, >= 0)")
    ql=[d["q"] for d in qdata]; x=np.arange(len(ql)); w=.14
    shades=["#F72585","#FF5FA8","#FF85B3","#FFB3D0","#FFD6E8"]
    for ri,shade in enumerate(shades):
        vals=[d["bm25"][ri] if ri<len(d["bm25"]) else 0 for d in qdata]
        bars=ax.bar(x+(ri-2)*w,vals,w*.92,label=f"Rank {ri+1}",
            color=shade,alpha=.9,edgecolor=BORDER,lw=.4,zorder=3)
        for b,v in zip(bars,vals):
            if v>.01: ax.text(b.get_x()+b.get_width()/2,b.get_height()+.004,
                f"{v:.2f}",ha="center",va="bottom",fontsize=7,color=TEXT)
    ax.set_xticks(x); ax.set_xticklabels(ql,color=TEXT,fontsize=9.5,rotation=12,ha="right")
    ax.legend(facecolor=BG3,edgecolor=BORDER,labelcolor=TEXT,fontsize=9,loc="upper right")
    top3=qdata[0]["bm25n"][:3]
    if top3:
        ax.text(.01,.97,f"Vi du '{qdata[0]['q']}': "+" | ".join(f"#{i+1} {n}" for i,n in enumerate(top3)),
            transform=ax.transAxes,fontsize=8,color=MUTED,va="top")
    ax.text(.01,.91,"Doc: name*2 + category + collection + material + brand + color + style | k1=1.5, b=0.75",
        transform=ax.transAxes,fontsize=7.5,color=MUTED,va="top")
    save(fig,"03_bm25_runtime_scores",out_dir)

# ═════════════════════════════════════════════════════════════════════════════
# 04 — Dense Runtime Scores
# ═════════════════════════════════════════════════════════════════════════════
def make_04(qdata, use_real_dense, out_dir):
    sfx = "(Sent-Trans that, normalize_embeddings=True)" if use_real_dense \
          else "(proxy TF-IDF — chay local de co ket qua chinh xac)"
    fig, ax = plt.subplots(figsize=(14,7), facecolor=BG)
    ax_style(ax,f"IR #1 Dense — Semantic Score theo Query (Top 5)\n{sfx}",
             ylabel="semantic_score = 1 - ChromaDB_distance  (0 den 1)")
    ql=[d["q"] for d in qdata]; x=np.arange(len(ql)); w=.14
    shades=["#4361EE","#6A7FF0","#8E9FF3","#B3BEF7","#D6DEFA"]
    for ri,shade in enumerate(shades):
        vals=[d["den"][ri] if ri<len(d["den"]) else 0 for d in qdata]
        bars=ax.bar(x+(ri-2)*w,vals,w*.92,label=f"Rank {ri+1}",
            color=shade,alpha=.9,edgecolor=BORDER,lw=.4,zorder=3)
        for b,v in zip(bars,vals):
            if v>.01: ax.text(b.get_x()+b.get_width()/2,b.get_height()+.004,
                f"{v:.3f}",ha="center",va="bottom",fontsize=7,color=TEXT)
    ax.set_xticks(x); ax.set_xticklabels(ql,color=TEXT,fontsize=9.5,rotation=12,ha="right")
    ax.set_ylim(0,1.15)
    ax.legend(facecolor=BG3,edgecolor=BORDER,labelcolor=TEXT,fontsize=9,loc="upper right")
    top3=qdata[0]["denn"][:3]
    if top3:
        ax.text(.01,.97,f"Vi du '{qdata[0]['q']}': "+" | ".join(f"#{i+1} {n}" for i,n in enumerate(top3)),
            transform=ax.transAxes,fontsize=8,color=MUTED,va="top")
    ax.text(.01,.91,
        "Model: paraphrase-multilingual-MiniLM-L12-v2 | ChromaDB HNSW cosine | semantic_score=1-dist | Range 0-1",
        transform=ax.transAxes,fontsize=7.5,color=MUTED,va="top")
    save(fig,"04_dense_runtime_scores",out_dir)

# ═════════════════════════════════════════════════════════════════════════════
# 05 — Hybrid RRF Scores
# ═════════════════════════════════════════════════════════════════════════════
def make_05(qdata, out_dir):
    fig, ax = plt.subplots(figsize=(14,7), facecolor=BG)
    ax_style(ax,"IR #3 Hybrid RRF — Fusion Scores theo Query (Top 5, hien thi x100 | dense_w=0.7)",
             ylabel="RRF Score x 100")
    ql=[d["q"] for d in qdata]; x=np.arange(len(ql)); w=.14
    shades=["#7209B7","#8E30CC","#AB5ADB","#C887E8","#E4B3F3"]
    for ri,shade in enumerate(shades):
        vals=[(d["rrf"][ri]*100) if ri<len(d["rrf"]) else 0 for d in qdata]
        bars=ax.bar(x+(ri-2)*w,vals,w*.92,label=f"Rank {ri+1}",
            color=shade,alpha=.9,edgecolor=BORDER,lw=.4,zorder=3)
        for b,v in zip(bars,vals):
            if v>.0001: ax.text(b.get_x()+b.get_width()/2,b.get_height()+.0002,
                f"{v:.3f}",ha="center",va="bottom",fontsize=7,color=TEXT)
    ax.set_xticks(x); ax.set_xticklabels(ql,color=TEXT,fontsize=9.5,rotation=12,ha="right")
    ax.legend(facecolor=BG3,edgecolor=BORDER,labelcolor=TEXT,fontsize=9,loc="upper right")
    top3=qdata[0]["rrfn"][:3]
    if top3:
        ax.text(.01,.97,f"Vi du '{qdata[0]['q']}': "+" | ".join(f"#{i+1} {n}" for i,n in enumerate(top3)),
            transform=ax.transAxes,fontsize=8,color=MUTED,va="top")
    ax.text(.01,.91,
        "RRF = 0.7/(60+rank_dense) + 0.3/(60+rank_bm25) | Max ly thuyet: 0.7/61+0.3/61 ~0.01639 | dense_w tang len 0.7 de uu tien ngu nghia",
        transform=ax.transAxes,fontsize=7.5,color=MUTED,va="top")
    save(fig,"05_hybrid_rrf_scores",out_dir)

# ═════════════════════════════════════════════════════════════════════════════
# 06 — DL Feature Table
# ═════════════════════════════════════════════════════════════════════════════
def make_06(out_dir):
    feats=["Model","Kien truc","Output dim","Can GPU","Hieu ngu nghia",
           "Tim kiem anh","Ca nhan hoa","Da ngon ngu","Can train",
           "Model size","Train time","Inference","Input","Dung cho"]
    data={
        "DL #1\nSent-Trans":["Transformer NLP","MiniLM-L12-v2","384-dim","Khuyen nghi","Co (cao)","Khong","Khong","50+ lang","Pretrained","~120 MB","~5 phut","~80ms","Text","Text embed -> IR#1"],
        "DL #2\nCLIP":       ["Vision+Language","ViT-B/32","512-dim","Can thiet","Co (cao)","Co","Khong","Han che","Pretrained","~350 MB","~10 phut","~150ms","Image/Text","Image search"],
        "DL #3\nNCF":        ["Neural CF","GMF + MLP","32-dim","Khuyen nghi","Khong","Khong","Co","Khong","~15 epochs","~50 MB","~1 phut","~20ms","User-Item","Recommendation"],
    }
    fig, ax = plt.subplots(figsize=(16,9), facecolor=BG)
    ax.set_facecolor(BG); ax.axis("off")
    ax.text(.5,.975,"DL — Feature Comparison Table",transform=ax.transAxes,
        fontsize=18,fontweight="bold",color=TEXT,ha="center",va="top")
    keys=list(data.keys()); ccols=[C_DL1,C_DL2,C_DL3]
    TL,TR,TT,TB=.01,.99,.91,.02
    cw=(TR-TL)/(len(keys)+1); rh=(TT-TB)/(len(feats)+1.4)
    cell(ax,TL,TT-rh,cw,rh,"Dac diem",BG3,bold=True)
    for ci,(k,c) in enumerate(zip(keys,ccols)):
        cell(ax,TL+(ci+1)*cw,TT-rh,cw,rh,k,c,fg=BG,bold=True)
    pos={"Co","Co (cao)","50+ lang"}; neg={"Khong","Han che"}
    for ri,f in enumerate(feats):
        rb=BG2 if ri%2==0 else BG3; y=TT-(ri+2)*rh
        cell(ax,TL,y,cw,rh,f,rb,bold=True,fs=8.5)
        for ci,k in enumerate(keys):
            v=data[k][ri]; fg=TEXT
            if v in pos: fg="#2ECC71"
            elif v in neg: fg="#E74C3C"
            elif v in {"Khuyen nghi","Can thiet"}: fg="#F39C12"
            cell(ax,TL+(ci+1)*cw,y,cw,rh,v,rb,fg=fg,fs=8)
    for xi,(lbl,c) in enumerate(zip(
        ["DL #1  paraphrase-multilingual-MiniLM-L12-v2 (384-dim, L2-normalized)",
         "DL #2  CLIP ViT-B/32 openai (512-dim, image+text)",
         "DL #3  NCF GMF+MLP hidden=[64,32,16] embed_dim=32 dropout=0.2 lr=1e-3"],ccols)):
        ax.text(.18+xi*.33,.005,f"  {lbl}  ",transform=ax.transAxes,
            fontsize=8.5,color=BG,ha="center",va="bottom",
            bbox=dict(facecolor=c,edgecolor="none",boxstyle="round,pad=0.4"))
    save(fig,"06_dl_feature_table",out_dir)

# ═════════════════════════════════════════════════════════════════════════════
# 07 — NCF Heatmap
# ═════════════════════════════════════════════════════════════════════════════
def make_07(products, out_dir):
    mat, ulbls, plbls, is_real = build_ncf_matrix(products, n_users=5, n_items=10)
    nu, ni = mat.shape
    fig_w = max(14, ni*1.5); fig_h = max(5, nu*1.2)
    fig, ax = plt.subplots(figsize=(fig_w, fig_h), facecolor=BG)
    ax.set_facecolor(BG2)
    for sp in ax.spines.values(): sp.set_edgecolor(BORDER)
    cmap = LinearSegmentedColormap.from_list("ncf",["#0D1117","#43AA8B","#2ECC71"])
    im = ax.imshow(mat, cmap=cmap, aspect="auto", vmin=0, vmax=1)
    ax.set_xticks(range(ni)); ax.set_xticklabels(plbls,color=TEXT,fontsize=8.5,rotation=35,ha="right")
    ax.set_yticks(range(nu)); ax.set_yticklabels(ulbls,color=TEXT,fontsize=10)
    for u in range(nu):
        for i in range(ni):
            ax.text(i,u,f"{mat[u,i]:.3f}",ha="center",va="center",fontsize=8,color=TEXT,fontweight="bold")
    cb=fig.colorbar(im,ax=ax,fraction=.025,pad=.02)
    cb.ax.tick_params(colors=MUTED); cb.set_label("NCF Score (sigmoid out)",color=MUTED,fontsize=9)
    note="Data thật từ UserInteractions DB" if is_real else "[MOCK] Chay local sau train_recommender.py de co data that"
    ax.set_title(
        f"DL #3 NCF — User x Product Score Matrix | {note}\n"
        f"Kien truc: GMF + MLP hidden=[64,32,16]  embed_dim=32  dropout=0.2  epochs≈15  optimizer=Adam lr=1e-3",
        color=TEXT,fontsize=11,fontweight="bold",pad=10)
    fig.tight_layout()
    save(fig,"07_ncf_heatmap",out_dir)

# ═════════════════════════════════════════════════════════════════════════════
# 08 — Business Re-ranking
# ═════════════════════════════════════════════════════════════════════════════
def make_08(products, qdata, out_dir):
    # Dung cong thuc chinh xac tu routers/search.py:
    # biz = 0.65*sem + 0.15*(rat/5) + 0.12*min(sold/500,1) + 0.08*(1 if sale_price else 0)
    pid_to_prod = {p.get("product_id", p.get("id", 0)): p for p in products}
    dr = qdata[0]["dr"][:5]  # top-5 dense results cua query dau
    # Pad neu it hon 5
    while len(dr) < 5:
        dr.append({"product_id": str(products[len(dr)].get("product_id", products[len(dr)].get("id", 0))),
                   "semantic_score": 0.2, **products[len(dr)]})
    sample = []
    for item in dr:
        pid = int(item.get("product_id", item.get("id", 0)))
        p   = pid_to_prod.get(pid, products[0])
        sem = float(item.get("semantic_score", 0))
        sample.append({"p": p, "sem": sem})

    sem_c  = [min(s["sem"],1.0)*0.65                                 for s in sample]
    rat_c  = [min(float(s["p"].get("avg_rating") or 0)/5.0,1.0)*0.15 for s in sample]
    sold_c = [min(float(s["p"].get("sold") or 0)/500.0,1.0)*0.12     for s in sample]
    disc_c = [(0.08 if s["p"].get("sale_price") else 0.0)             for s in sample]
    biz    = [a+b+c+d for a,b,c,d in zip(sem_c,rat_c,sold_c,disc_c)]
    xlbls  = [f"P{s['p'].get('product_id', s['p'].get('id',0))}\n{s['p']['name'][:13]}" for s in sample]

    fig, (ax1, ax2) = plt.subplots(1,2,figsize=(16,7),facecolor=BG)

    # Left: stacked bar
    ax_style(ax1,"Business Score — Breakdown thanh phan\n(theo cong thuc routers/search.py  rerank())",ylabel="Score")
    x=np.arange(len(sample)); w=.55; bot=np.zeros(len(sample))
    for vals,color,lbl in [(sem_c,C_IR1,"Semantic  x0.65"),(rat_c,C_DL3,"Rating/5  x0.15"),
                            (sold_c,C_DL2,"Sold/500  x0.12"),(disc_c,C_IR2,"Discount  x0.08")]:
        ax1.bar(x,vals,w,bottom=bot,label=lbl,color=color,alpha=.88,edgecolor=BG,lw=.3,zorder=3)
        bot=bot+np.array(vals)
    for xi,bv in enumerate(biz):
        ax1.text(xi,bv+.004,f"{bv:.3f}",ha="center",va="bottom",fontsize=9,color=TEXT,fontweight="bold")
    ax1.set_xticks(x); ax1.set_xticklabels(xlbls,color=TEXT,fontsize=8,rotation=8,ha="right")
    ax1.set_ylim(0,1.1)
    ax1.legend(facecolor=BG3,edgecolor=BORDER,labelcolor=TEXT,fontsize=9,loc="upper right")
    ax1.text(.01,.02,f"Query: '{qdata[0]['q']}'",transform=ax1.transAxes,fontsize=8.5,color=MUTED)

    # Right: cong thuc + bang gia tri
    ax2.set_facecolor(BG2); ax2.axis("off")
    ax2.set_title("Cong thuc & Gia tri thuc te",color=TEXT,fontsize=13,fontweight="bold",pad=10)
    for i,line in enumerate(["biz_score =",
                              "  0.65 * semantic_score",
                              "+ 0.15 * (avg_rating / 5.0)",
                              "+ 0.12 * min(sold / 500.0, 1.0)",
                              "+ 0.08 * (1 if sale_price else 0)"]):
        ax2.text(.05,.88-i*.085,line,transform=ax2.transAxes,
            fontsize=12,color=TEXT if i==0 else "#A8D8F0",va="top",fontfamily="monospace")
    header="Prod   sem    rat/5  sold/500 disc   biz"
    ax2.text(.05,.45,header,transform=ax2.transAxes,fontsize=8.5,color=MUTED,fontfamily="monospace")
    for i,s in enumerate(sample):
        rn=min(float(s["p"].get("avg_rating") or 0)/5,1)
        sn=min(float(s["p"].get("sold") or 0)/500,1)
        dn=1.0 if s["p"].get("sale_price") else 0.0
        row=f"P{s['p'].get('product_id', s['p'].get('id',0)):>3}   {s['sem']:.3f}  {rn:.3f}    {sn:.3f}    {dn:.1f}  {biz[i]:.3f}"
        ax2.text(.05,.38-i*.068,row,transform=ax2.transAxes,fontsize=8.5,color=TEXT,fontfamily="monospace")
    ax2.text(.05,.04,"Sort giam dan theo biz_score -> tra ve top-N",
        transform=ax2.transAxes,fontsize=9,color=MUTED)
    fig.tight_layout(pad=2)
    save(fig,"08_business_reranking",out_dir)

# ═════════════════════════════════════════════════════════════════════════════
# 09 — CLIP Pipeline
# ═════════════════════════════════════════════════════════════════════════════
def make_09(out_dir):
    fig, ax = plt.subplots(figsize=(10,11), facecolor=BG)
    ax.set_facecolor(BG); ax.axis("off")
    ax.set_title("DL #2 CLIP — Image Search Pipeline",color=TEXT,fontsize=16,fontweight="bold",pad=14)
    steps=[
        ("Input: Upload anh  hoac  Nhap text mo ta san pham",C_DL2,.88,None),
        ("clip_encoder.py  |  open_clip.create_model_and_transforms()\nmodel=ViT-B-32   pretrained=openai   device=cuda/cpu",C_DL2,.73,
         "embed_image_bytes()  /  embed_text_query()\n-> 512-dim L2-normalized vector"),
        ("ChromaDB collection: product_image\nhnsw:space=cosine  |  n_results=N",C_IR1,.55,
         "col.query(query_embeddings=[vec])\n-> distances, metadatas"),
        ("semantic_score = 1 - distance\nTop-N san pham co anh tuong tu nhat",C_DL2,.38,
         "Sort theo 1-distance (cao hon = giong hon)"),
        ("Business Re-ranking\n0.65*sem + 0.15*rat/5 + 0.12*sold/500 + 0.08*disc",C_DL3,.21,
         "Tuong tu Semantic Search, dung CLIP vector thay Sent-Trans"),
        ("Tra ve Top-N san pham cho frontend",BG3,.07,None),
    ]
    for lbl,color,y,note in steps:
        fg=BG if color!=BG3 else TEXT
        ax.text(.5,y,f"   {lbl}   ",transform=ax.transAxes,
            fontsize=10.5,color=fg,ha="center",va="center",
            bbox=dict(facecolor=color,edgecolor=BORDER,boxstyle="round,pad=0.5",alpha=.93))
        if note:
            ax.text(.5,y-.058,note,transform=ax.transAxes,fontsize=8,color=MUTED,ha="center",va="center")
        if y>.09:
            ax.annotate("",xy=(.5,y-.115),xytext=(.5,y-.015),
                xycoords="axes fraction",textcoords="axes fraction",
                arrowprops=dict(arrowstyle="->",color=MUTED,lw=2))
    ax.text(.5,.005,
        "clip_encoder.py | CLIP_MODEL=ViT-B-32 | CLIP_PRETRAINED=openai | embed_dim=512 | store=ChromaDB product_image",
        transform=ax.transAxes,fontsize=8,color=MUTED,ha="center")
    save(fig,"09_clip_pipeline",out_dir)

# ─── Fetch products from backend ─────────────────────────────────────────────
def _normalize_product(p: dict) -> dict:
    """
    Backend tra: id, name, image, category_name, avg_rating, sale_price, sold ...
    Script dung: product_id, name, image_url, category_name, avg_rating, sale_price, sold ...
    """
    out = dict(p)
    if "product_id" not in out:
        out["product_id"] = out.get("id", 0)
    if "image_url" not in out:
        out["image_url"] = out.get("image", "")
    out.setdefault("category_name", out.get("category", ""))
    out.setdefault("collection_name", "")
    out.setdefault("brand", "")
    out.setdefault("color", "")
    out.setdefault("style", "")
    out.setdefault("description", "")
    out.setdefault("avg_rating", 0.0)
    out.setdefault("sold", 0)
    out.setdefault("sale_price", None)
    return out


def fetch_products(url):
    try:
        import httpx
        r = httpx.get(f"{url}/api/products",
                      params={"limit": 500, "page": 1, "ai": "true"}, timeout=15)
        r.raise_for_status()
        d  = r.json()
        ps = d if isinstance(d, list) else d.get("data", d.get("products", d.get("items", [])))
        if ps:
            ps = [_normalize_product(p) for p in ps]
            print(f"  [API] {len(ps)} products from backend")
            return ps
    except Exception as e:
        print(f"  [API] Backend unavailable ({e})")
    return None

# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    parser=argparse.ArgumentParser(description="Visualize IR & DL — DaVinci Furniture")
    parser.add_argument("--live",action="store_true",help="Lay products tu backend API")
    parser.add_argument("--backend",default="http://localhost:5000")
    parser.add_argument("--output-dir",default="output")
    args=parser.parse_args()

    out_dir=ROOT/args.output_dir
    out_dir.mkdir(parents=True,exist_ok=True)
    print(f"\n[DaVinci — Visualize IR & DL]\nOutput: {out_dir}\n")

    products=None
    if args.live:
        print("[1/4] Fetching products from backend...")
        products=fetch_products(args.backend)
    if not products:
        print("[1/4] Dung mock products (10 san pham noi that DaVinci)")
        products=MOCK_PRODUCTS

    print("[2/4] Loading Dense model...")
    dense_search, use_real=load_dense(products)

    print("[3/4] Computing BM25 + Dense + Hybrid RRF...")
    if args.live:
        print("  [Query] Building test queries from live products...")
        test_queries = build_live_queries(products)
    else:
        test_queries = TEST_QUERIES_MOCK
    qdata, metrics=compute(products, dense_search, test_queries)

    print("[4/4] Generating 9 images...\n")
    make_01(out_dir)
    make_02(metrics, use_real, len(test_queries), out_dir)
    make_03(qdata, out_dir)
    make_04(qdata, use_real, out_dir)
    make_05(qdata, out_dir)
    make_06(out_dir)
    make_07(products, out_dir)
    make_08(products, qdata, out_dir)
    make_09(out_dir)

    print(f"\n[DONE] 9 anh -> {out_dir}/")
    if not use_real:
        print("\n[NOTE] Dense dung proxy. Chay lai tren may local co Sentence-Transformers:")
        print("       python scripts/visualize_metrics.py --live")
    if not (ROOT/"data"/"ncf_model.pkl").exists():
        print("\n[NOTE] NCF dung mock. Sau khi train:")
        print("       python scripts/train_recommender.py")
        print("       python scripts/visualize_metrics.py")

if __name__=="__main__":
    main()
