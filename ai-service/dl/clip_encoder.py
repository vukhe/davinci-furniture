"""
CLIP helpers for image and text embeddings.
"""
import io
import os

import open_clip
import torch
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

CLIP_MODEL_NAME = os.getenv("CLIP_MODEL", "ViT-B-32")
CLIP_PRETRAINED = os.getenv("CLIP_PRETRAINED", "openai")

_model = None
_preprocess = None
_tokenizer = None
_device = "cuda" if torch.cuda.is_available() else "cpu"


def _load():
    global _model, _preprocess, _tokenizer
    if _model is None:
        print(f"[CLIP] Loading {CLIP_MODEL_NAME} ({CLIP_PRETRAINED}) on {_device}")
        _model, _, _preprocess = open_clip.create_model_and_transforms(
            CLIP_MODEL_NAME,
            pretrained=CLIP_PRETRAINED,
        )
        _tokenizer = open_clip.get_tokenizer(CLIP_MODEL_NAME)
        _model = _model.to(_device)
        _model.eval()
        print("[CLIP] Model loaded OK")


def embed_image_bytes(image_bytes: bytes) -> list[float]:
    """Embed an image from raw bytes."""
    _load()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = _preprocess(image).unsqueeze(0).to(_device)
    with torch.no_grad():
        features = _model.encode_image(tensor)
        features /= features.norm(dim=-1, keepdim=True)
    return features.squeeze().cpu().numpy().tolist()


def embed_image_url(url: str) -> list[float]:
    """Embed an image fetched from a public URL."""
    import httpx

    response = httpx.get(url, timeout=10)
    response.raise_for_status()
    return embed_image_bytes(response.content)


def embed_image_file(path: str) -> list[float]:
    """Embed an image from a local file path."""
    with open(path, "rb") as file_obj:
        return embed_image_bytes(file_obj.read())


def embed_text_clip(text: str) -> list[float]:
    """Embed text with CLIP for image-text search."""
    _load()
    tokens = _tokenizer([text]).to(_device)
    with torch.no_grad():
        features = _model.encode_text(tokens)
        features /= features.norm(dim=-1, keepdim=True)
    return features.squeeze().cpu().numpy().tolist()
