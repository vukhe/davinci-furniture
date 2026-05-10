"""
dl/ncf_model.py
Neural Collaborative Filtering (NCF) — Deep Learning model #3

Kiến trúc: GMF + MLP fusion (He et al., 2017 — "Neural Collaborative Filtering")
  - GMF (Generalized Matrix Factorization): element-wise product của user/item embeddings
  - MLP: concatenate embeddings → 3 hidden layers với ReLU + Dropout
  - Fusion: ghép GMF output + MLP output → output layer sigmoid

Ưu điểm so với SVD:
  - Học được non-linear interaction giữa user và item
  - Embedding layer là DL representation learning thật sự
  - Dropout giúp tránh overfit khi data ít

Usage:
    from models.ncf_model import get_ncf_recommender
    ncf = get_ncf_recommender()
    if ncf.is_trained:
        recs = ncf.recommend(user_id=1, n=10)
"""

import pickle
from pathlib import Path


import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

MODEL_PATH = Path(__file__).resolve().parents[1] / "data" / "ncf_model.pkl"

# ── PyTorch module ─────────────────────────────────────────────────────────────

class _NCF(nn.Module):
    """
    NeuMF: Generalized Matrix Factorization + Multi-Layer Perceptron.

    Input: (user_idx tensor, item_idx tensor)
    Output: predicted interaction score trong [0, 1]
    """

    def __init__(
        self,
        n_users: int,
        n_items: int,
        embed_dim: int = 32,
        mlp_hidden: list[int] = None,
        dropout: float = 0.2,
    ):
        super().__init__()
        if mlp_hidden is None:
            mlp_hidden = [64, 32, 16]

        # ── GMF branch ──────────────────────────────────────────────────────
        self.user_embed_gmf = nn.Embedding(n_users, embed_dim)
        self.item_embed_gmf = nn.Embedding(n_items, embed_dim)

        # ── MLP branch ──────────────────────────────────────────────────────
        self.user_embed_mlp = nn.Embedding(n_users, embed_dim)
        self.item_embed_mlp = nn.Embedding(n_items, embed_dim)

        mlp_layers: list[nn.Module] = []
        in_dim = embed_dim * 2
        for out_dim in mlp_hidden:
            mlp_layers += [
                nn.Linear(in_dim, out_dim),
                nn.ReLU(),
                nn.Dropout(dropout),
            ]
            in_dim = out_dim
        self.mlp = nn.Sequential(*mlp_layers)

        # ── Fusion layer ────────────────────────────────────────────────────
        self.output_layer = nn.Linear(embed_dim + mlp_hidden[-1], 1)
        self.sigmoid = nn.Sigmoid()

        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                nn.init.zeros_(m.bias)
            elif isinstance(m, nn.Embedding):
                nn.init.normal_(m.weight, std=0.01)

    def forward(self, user_ids: torch.Tensor, item_ids: torch.Tensor) -> torch.Tensor:
        # GMF
        u_gmf = self.user_embed_gmf(user_ids)
        i_gmf = self.item_embed_gmf(item_ids)
        gmf_out = u_gmf * i_gmf  # element-wise — non-linear interaction

        # MLP
        u_mlp = self.user_embed_mlp(user_ids)
        i_mlp = self.item_embed_mlp(item_ids)
        mlp_out = self.mlp(torch.cat([u_mlp, i_mlp], dim=-1))

        # Fusion: concat GMF + MLP → sigmoid
        fusion = torch.cat([gmf_out, mlp_out], dim=-1)
        return self.sigmoid(self.output_layer(fusion)).squeeze(-1)


# ── Dataset ───────────────────────────────────────────────────────────────────

class _InteractionDataset(Dataset):
    def __init__(self, user_ids, item_ids, scores):
        self.user_ids = torch.tensor(user_ids, dtype=torch.long)
        self.item_ids = torch.tensor(item_ids, dtype=torch.long)
        self.scores   = torch.tensor(scores,    dtype=torch.float32)

    def __len__(self):
        return len(self.user_ids)

    def __getitem__(self, idx):
        return self.user_ids[idx], self.item_ids[idx], self.scores[idx]


# ── Wrapper class ─────────────────────────────────────────────────────────────

class NCFRecommender:
    """
    Wrapper quản lý toàn bộ lifecycle: train → save → load → recommend.
    Giao diện giống CollaborativeRecommender để dễ swap.
    """

    def __init__(self, embed_dim: int = 32, epochs: int = 15, lr: float = 1e-3, batch_size: int = 256):
        self.embed_dim  = embed_dim
        self.epochs     = epochs
        self.lr         = lr
        self.batch_size = batch_size
        self.is_trained = False

        self.user_index:     dict[int, int] = {}
        self.item_index:     dict[int, int] = {}
        self.item_index_rev: dict[int, int] = {}
        self._user_seen:     dict[int, set] = {}

        self._model: _NCF | None = None
        self._device = "cuda" if torch.cuda.is_available() else "cpu"

    # ── Training ──────────────────────────────────────────────────────────────

    def train(self, df: pd.DataFrame):
        """
        df: columns [user_id, product_id, score]
        Score được normalize về [0,1] trước khi đưa vào BCE loss.
        """
        if len(df) < 10:
            print("[NCF] Không đủ dữ liệu (cần ≥ 10 interactions)")
            return

        # Build index
        users = df["user_id"].unique()
        items = df["product_id"].unique()
        self.user_index     = {u: i for i, u in enumerate(users)}
        self.item_index     = {p: i for i, p in enumerate(items)}
        self.item_index_rev = {i: p for p, i in self.item_index.items()}
        self._user_seen = (
            df.groupby("user_id")["product_id"].apply(set).to_dict()
        )

        # Normalize scores to [0, 1] for BCE
        max_score = df["score"].max() or 1.0
        norm_scores = (df["score"] / max_score).values

        user_idxs = df["user_id"].map(self.user_index).values
        item_idxs = df["product_id"].map(self.item_index).values

        dataset    = _InteractionDataset(user_idxs, item_idxs, norm_scores)
        dataloader = DataLoader(dataset, batch_size=self.batch_size, shuffle=True)

        # Build model
        self._model = _NCF(
            n_users=len(users),
            n_items=len(items),
            embed_dim=self.embed_dim,
        ).to(self._device)

        optimizer = torch.optim.Adam(self._model.parameters(), lr=self.lr, weight_decay=1e-5)
        loss_fn   = nn.BCELoss()

        self._model.train()
        for epoch in range(self.epochs):
            total_loss = 0.0
            for u_batch, i_batch, s_batch in dataloader:
                u_batch = u_batch.to(self._device)
                i_batch = i_batch.to(self._device)
                s_batch = s_batch.to(self._device)

                optimizer.zero_grad()
                preds = self._model(u_batch, i_batch)
                loss  = loss_fn(preds, s_batch)
                loss.backward()
                optimizer.step()
                total_loss += loss.item()

            if (epoch + 1) % 5 == 0:
                avg = total_loss / len(dataloader)
                print(f"[NCF] Epoch {epoch+1}/{self.epochs}  loss={avg:.4f}")

        self.is_trained = True
        n_params = sum(p.numel() for p in self._model.parameters())
        print(
            f"[NCF] Trained — {len(users)} users × {len(items)} items, "
            f"embed_dim={self.embed_dim}, params={n_params:,}"
        )

    # ── Inference ─────────────────────────────────────────────────────────────

    @torch.no_grad()
    def recommend(
        self,
        user_id: int,
        n: int = 10,
        exclude_seen: list | None = None,
    ) -> list[dict]:
        if not self.is_trained or self._model is None:
            return []

        if user_id not in self.user_index:
            return self._popular_fallback(n)

        self._model.eval()
        user_idx = self.user_index[user_id]
        n_items  = len(self.item_index)

        user_tensor = torch.tensor([user_idx] * n_items, dtype=torch.long, device=self._device)
        item_tensor = torch.tensor(list(range(n_items)),  dtype=torch.long, device=self._device)

        scores = self._model(user_tensor, item_tensor).cpu().numpy()  # (n_items,)

        # Exclude seen items
        auto_seen  = self._user_seen.get(user_id, set())
        extra_seen: set = set()
        for pid in (exclude_seen or []):
            try:
                extra_seen.add(int(pid))
            except (TypeError, ValueError):
                extra_seen.add(pid)
        exclude_set = auto_seen | extra_seen

        results = []
        for item_idx in np.argsort(scores)[::-1]:
            pid = self.item_index_rev[item_idx]
            if pid not in exclude_set:
                results.append({
                    "product_id": pid,
                    "score": round(float(scores[item_idx]), 4),
                })
            if len(results) >= n:
                break

        return results

    @torch.no_grad()
    def _popular_fallback(self, n: int) -> list[dict]:
        """Dùng khi user_id không có trong training set (cold-start)."""
        if not self.is_trained or self._model is None:
            return []
        self._model.eval()
        n_items = len(self.item_index)
        # Score items từ quan điểm user_id=0 (proxy for popularity)
        user_tensor = torch.zeros(n_items, dtype=torch.long, device=self._device)
        item_tensor = torch.tensor(list(range(n_items)), dtype=torch.long, device=self._device)
        scores = self._model(user_tensor, item_tensor).cpu().numpy()
        top = np.argsort(scores)[::-1][:n]
        return [
            {"product_id": self.item_index_rev[i], "score": round(float(scores[i]), 4)}
            for i in top
        ]

    def seen_products(self, user_id: int) -> list:
        return list(self._user_seen.get(user_id, set()))

    # ── Persistence ───────────────────────────────────────────────────────────

    def save(self):
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        # Chuyển model về CPU trước khi pickle để load được trên máy khác
        if self._model is not None:
            self._model = self._model.cpu()
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(self, f)
        if self._model is not None:
            self._model = self._model.to(self._device)
        print(f"[NCF] Model saved → {MODEL_PATH}")

    @classmethod
    def load(cls) -> "NCFRecommender":
        if MODEL_PATH.exists():
            try:
                with open(MODEL_PATH, "rb") as f:
                    obj: NCFRecommender = pickle.load(f)
                # Move model to available device
                if obj._model is not None:
                    obj._device = "cuda" if torch.cuda.is_available() else "cpu"
                    obj._model = obj._model.to(obj._device)
                print("[NCF] Model loaded from disk OK")
                return obj
            except Exception as exc:
                print(f"[NCF][WARN] Load failed ({exc}), creating new instance.")
        print("[NCF] No saved model, creating new instance")
        return cls()


# ── Singleton ─────────────────────────────────────────────────────────────────

_ncf: NCFRecommender | None = None


def get_ncf_recommender() -> NCFRecommender:
    global _ncf
    if _ncf is None:
        _ncf = NCFRecommender.load()
    return _ncf


def reload_ncf() -> NCFRecommender:
    global _ncf
    _ncf = NCFRecommender.load()
    return _ncf
