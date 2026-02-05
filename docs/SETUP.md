# OrthoAI Setup (llama.cpp + ChromaDB)

This guide documents the exact setup flow used for local development.

## 0) Create a Hugging Face account (required for BioMistral)

Create an account and (if prompted) accept the model terms:

```text
https://huggingface.co/join
https://huggingface.co/BioMistral/BioMistral-7B-GGUF
```

If the model is gated, create a read token:

```text
https://huggingface.co/settings/tokens
```

## 1) Install llama.cpp (server runtime)

```zsh
brew install llama.cpp
```

## 2) Download and run the LLM server (BioMistral 7B)

Start the server and let `llama-server` download the model for you.

```zsh
llama-server \
  --hf-repo tensorblock/BioMistral-7B-GGUF \
  --hf-file BioMistral-7B-Q4_K_M.gguf \
  --alias biomistral-7b-instruct \
  --port 8080
```

Optional (higher quality, larger):

```zsh
llama-server \
  --hf-repo tensorblock/BioMistral-7B-GGUF \
  --hf-file BioMistral-7B-Q5_K_M.gguf \
  --alias biomistral-7b-instruct \
  --port 8080
```

Verify:

```zsh
curl http://127.0.0.1:8080/v1/models
```

Expected `id`:
`biomistral-7b-instruct`

## 3) Download and run the embedding server (nomic-embed-text)

```zsh
llama-server \
  --hf-repo nomic-ai/nomic-embed-text-v1.5-GGUF \
  --hf-file nomic-embed-text-v1.5.Q5_K_M.gguf \
  --embedding \
  --alias nomic-embed-text \
  --port 8081
```

Verify:

```zsh
curl http://127.0.0.1:8081/v1/models
```

Expected `id`:
`nomic-embed-text`

## 4) Configure the app

Create `.env.local` in the repo root:

```zsh
cat <<'EOF' > .env.local
LLM_BASE_URL=http://127.0.0.1:8080/v1
LLM_DEFAULT_MODEL=biomistral-7b-instruct
EMBEDDING_BASE_URL=http://127.0.0.1:8081/v1
EMBEDDING_MODEL=nomic-embed-text

MEMORY_DB_PATH=./.data/orthoai.db
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_DB_PATH=./.data/chroma
EOF
```

## 5) Install Docker Desktop (required for ChromaDB)

Download and install Docker Desktop:

```text
https://www.docker.com/products/docker-desktop/
```

Start Docker Desktop before running ChromaDB.

## 6) Start ChromaDB (vector store)

```zsh
npm run chroma-start
```

## 7) Install dependencies and run the app

```zsh
npm install
npm run dev
```

Open:
`http://localhost:3000`

## Notes

- The app expects an OpenAI-compatible server at `LLM_BASE_URL` and
  an embeddings server at `EMBEDDING_BASE_URL`.
- Keep both `llama-server` processes running while using the UI.
- If downloads fail, verify the repo/file names match the GGUF list
  in the repo.
