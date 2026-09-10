import os

import gradio as gr
import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = os.environ.get("MODEL_NAME", "all-MiniLM-L6-v2")
model = SentenceTransformer(MODEL_NAME)

KEYWORDS = {
    "AGR": ("farmer", "crop", "paddy", "irrigation", "seed", "animal"),
    "WAT": ("water", "pipeline", "borewell", "drain", "sewage", "toilet"),
    "HLT": ("hospital", "health", "medicine", "doctor", "clinic", "ambulance"),
    "EDU": ("school", "college", "student", "teacher", "education", "skill"),
    "PWR": ("electricity", "power", "transformer", "streetlight", "voltage"),
    "INF": ("road", "pothole", "bridge", "traffic", "footpath", "building"),
    "SWM": ("garbage", "waste", "sanitation", "dump", "recycling", "litter"),
}


def classify(text: str) -> str:
    lowered = text.lower()
    for category, words in KEYWORDS.items():
        if any(word in lowered for word in words):
            return category
    return "OTH"


def embed_text(text: str) -> tuple[str, str, str]:
    cleaned = text.strip()
    if not cleaned:
        return "Enter a complaint to generate an embedding.", "", ""

    vector = model.encode([cleaned], normalize_embeddings=True, convert_to_numpy=True)[0]
    preview = ", ".join(f"{value:.5f}" for value in vector[:8])
    return (
        classify(cleaned),
        f"{len(vector)} dimensions",
        f"[{preview}, …]",
    )


demo = gr.Interface(
    fn=embed_text,
    inputs=gr.Textbox(
        label="Community issue",
        placeholder="Example: The drinking water pipeline has been leaking for a week.",
        lines=4,
    ),
    outputs=[
        gr.Textbox(label="Suggested category"),
        gr.Textbox(label="Embedding size"),
        gr.Textbox(label="Embedding preview"),
    ],
    title="Community Issue Semantic Analyzer",
    description="Generate a normalized Sentence-BERT embedding preview and a suggested issue category.",
    examples=[
        ["The road near the school has deep potholes."],
        ["The village water pipeline has been broken for two weeks."],
    ],
)

if __name__ == "__main__":
    demo.launch()
