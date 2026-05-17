#!/bin/bash
# Script push code lên GitHub
# Usage: bash scripts/push-to-github.sh

set -e

REPO_URL="https://github.com/hathientuyethy2004-del/Travel-Dashboard.git"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ Lỗi: GITHUB_TOKEN chưa được set"
  exit 1
fi

AUTHED_URL="https://${GITHUB_TOKEN}@github.com/hathientuyethy2004-del/Travel-Dashboard.git"

echo "🔧 Cấu hình remote origin..."
git remote set-url origin "$AUTHED_URL"

echo "📋 Trạng thái hiện tại:"
git log --oneline -3

echo ""
echo "⬆️  Đang push lên GitHub..."
git push origin main

echo ""
echo "✅ Push thành công lên: $REPO_URL"

# Reset URL về không có token (bảo mật)
git remote set-url origin "$REPO_URL"
echo "🔒 Đã reset remote URL (xóa token khỏi config)"
