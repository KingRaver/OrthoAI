# Complete Node/Next.js clean rebuild for Hacker Reign (production safe)

# 1. Stop all processes
pkill -f "node"
pkill -f "next"
pkill -f "ollama"  # If needed
pkill -f "python.*flask"  # DL server

# 2. Full clean
rm -rf node_modules
rm -rf .next
rm -rf .data  # Memory/RAG/DL models (backup first if needed)
rm package-lock.json
rm yarn.lock  # If exists

# 3. Clear caches
rm -rf .nuxt  # If Nuxt mixed
npx browserslist@latest --update-db
npm cache clean --force

# 4. Fresh reinstall
npm install

# 5. Rebuild + dev
npm run build  # Optional: test build
npm run dev

# QUICK ONE-LINER:
rm -rf node_modules .next package-lock.json && npm install && npm run dev
