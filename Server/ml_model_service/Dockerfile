FROM python:3.11-slim

# Build tools needed by prophet / statsmodels / scikit-learn wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
# Install the CPU-only build of PyTorch FIRST so sentence-transformers reuses it
# instead of pulling the default GPU wheel, which drags in multi-GB NVIDIA/CUDA
# libraries (libcublasLt, cudnn, ...) that this CPU service never uses and which
# blow up the image size (and exhaust disk on small instances).
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

# Pre-download the sentence-transformers embedding model so the RAG recipe
# service doesn't fetch it from the HuggingFace Hub on the first request.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Copy the source into a package directory so the app can be launched in
# package mode (uvicorn ml_model_service.main:app). The modules use
# package-relative imports (from .models / from ..data), which only resolve
# when main is imported as part of the ml_model_service package.
COPY . ./ml_model_service/

EXPOSE 5002

CMD ["uvicorn", "ml_model_service.main:app", "--host", "0.0.0.0", "--port", "5002"]
