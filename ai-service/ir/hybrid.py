"""
ir/hybrid.py — IR #3: Hybrid Retrieval via Reciprocal Rank Fusion (RRF)
=========================================================================
Kết hợp Dense Retrieval (IR #1) + BM25 (IR #2):

Công thức RRF (Cormack et al. 2009):
    score(d) = Σ  weight_i / (k + rank_i(d))

Ưu điểm:
  - Không cần normalize score giữa Dense và BM25 (khác thang đo)
  - k=60 tối ưu cho hầu hết trường hợp theo nghiên cứu gốc
  - Dense giỏi: truy vấn ngữ nghĩa ("ghế thoải mái cho lưng")
  - BM25 giỏi:  exact keyword ("Eames Chair Herman Miller")
"""


def reciprocal_rank_fusion(
    dense_results:  list[dict],
    sparse_results: list[dict],
    k:              int   = 60,
    dense_weight:   float = 0.4,   # tăng lên cùng với cải thiện Dense document-expansion
    sparse_weight:  float = 0.6,   # BM25 vẫn dẫn đầu nhưng giảm nhẹ để Dense có trọng số hơn
) -> list[dict]:
    """
    Merge 2 ranked lists bằng RRF — không cần normalize score.

    Args:
        dense_results:  top-N từ Dense Retrieval (ChromaDB HNSW)
        sparse_results: top-N từ BM25 Sparse Retrieval
        k:              hằng số làm mịn (mặc định 60)
        dense_weight:   trọng số cho dense list
        sparse_weight:  trọng số cho sparse list

    Returns:
        Merged list sorted by RRF score giảm dần.
    """
    rrf_scores: dict[str, float] = {}
    all_meta:   dict[str, dict]  = {}

    # Score gate: chỉ include Dense results có semantic_score đủ cao
    # Tránh Dense results kém chất lượng kéo Hybrid xuống dưới BM25
    MIN_DENSE_SCORE = 0.05  # giảm 0.15 → 0.05: tránh lọc mất kết quả Dense hợp lệ
    dense_filtered = [x for x in dense_results
                      if x.get("semantic_score", x.get("bm25_score", 1.0)) > MIN_DENSE_SCORE]

    for rank, item in enumerate(dense_filtered, start=1):
        pid = str(item["product_id"])
        rrf_scores[pid] = rrf_scores.get(pid, 0.0) + dense_weight / (k + rank)
        all_meta[pid]   = item

    for rank, item in enumerate(sparse_results, start=1):
        pid = str(item["product_id"])
        rrf_scores[pid] = rrf_scores.get(pid, 0.0) + sparse_weight / (k + rank)
        if pid not in all_meta:
            all_meta[pid] = item

    merged = []
    for pid in sorted(rrf_scores, key=lambda p: rrf_scores[p], reverse=True):
        meta = all_meta[pid].copy()
        meta["rrf_score"]  = round(rrf_scores[pid], 6)
        meta["product_id"] = pid
        merged.append(meta)

    return merged