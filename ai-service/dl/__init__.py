"""
dl/ — Deep Learning
=====================
DL #1  embedder.py      Sentence-Transformers — text embeddings (multilingual)
DL #2  clip_encoder.py  CLIP ViT-B-32 — image + text embeddings
DL #3  ncf_model.py     Neural Collaborative Filtering (GMF + MLP, PyTorch)
"""
from .embedder     import embed_text, embed_batch, embed_batch_safe, build_product_text
from .clip_encoder import embed_image_bytes, embed_image_url, embed_text_clip
from .ncf_model    import get_ncf_recommender, reload_ncf

__all__ = [
    "embed_text", "embed_batch", "embed_batch_safe", "build_product_text",
    "embed_image_bytes", "embed_image_url", "embed_text_clip",
    "get_ncf_recommender", "reload_ncf",
]
