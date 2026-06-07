#!/bin/bash
# ============================================================================
# Tab Out — Safari Extension Build Script
# ============================================================================
# This script prepares the extension for Safari and invokes Apple's
# safari-web-extension-packager to generate an Xcode project.
#
# Prerequisites:
#   - macOS with Xcode installed
#   - Safari 14+ (for Web Extension support)
#
# Usage:
#   chmod +x build-safari.sh
#   ./build-safari.sh
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="${SCRIPT_DIR}/extension"
BUILD_DIR="${SCRIPT_DIR}/safari-build"
BUNDLE_ID="com.zarazhangrui.tab-out"
APP_NAME="Tab Out"

echo "🚀 Tab Out — Safari Extension Builder"
echo "======================================"

# ─── 1. Check prerequisites ─────────────────────────────────────────────────

if ! command -v xcrun &> /dev/null; then
  echo "❌ Error: xcrun not found. Please install Xcode from the Mac App Store."
  exit 1
fi

if ! xcrun --find safari-web-extension-packager &> /dev/null; then
  echo "❌ Error: safari-web-extension-packager not found."
  echo "   Please ensure Xcode is installed and its command-line tools are available:"
  echo "   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

echo "✅ Xcode and safari-web-extension-packager found"

# ─── 2. Check for existing Xcode project ────────────────────────────────────

# Find existing Xcode project (packager creates it in a subfolder named after the app)
EXISTING_PROJECT=$(find "${SCRIPT_DIR}" -maxdepth 2 -name "*.xcodeproj" -type d | head -n 1)

if [ -n "${EXISTING_PROJECT}" ]; then
  echo "✅ Existing Xcode project found: ${EXISTING_PROJECT}"
  echo "   Will update extension resources only, preserving your signing settings."
  UPDATE_MODE=true
  PROJECT_NAME=$(basename "${EXISTING_PROJECT}" .xcodeproj)
  PROJECT_DIR=$(dirname "${EXISTING_PROJECT}")
else
  UPDATE_MODE=false
fi

# ─── 3. Prepare Safari extension directory ──────────────────────────────────

# Clean previous build
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

# Copy extension files
cp -R "${EXTENSION_DIR}/" "${BUILD_DIR}/"

# Replace manifest.json with Safari version
cp "${BUILD_DIR}/manifest-safari.json" "${BUILD_DIR}/manifest.json"
rm "${BUILD_DIR}/manifest-safari.json"

echo "✅ Extension files copied to ${BUILD_DIR}"

# ─── 4. Build or update ─────────────────────────────────────────────────────

if [ "$UPDATE_MODE" = true ]; then
  echo ""
  echo "🔄 Updating extension resources in existing project..."

  # The extension resources are inside the .app bundle within the Xcode project
  # Find the extension directory inside the project
  EXTENSION_RESOURCE_DIR=$(find "${PROJECT_DIR}" -type d -name "Tab Out Extension" | head -n 1)

  if [ -n "${EXTENSION_RESOURCE_DIR}" ]; then
    # Find the Resources folder which contains the web extension files
    RESOURCES_DIR=$(find "${EXTENSION_RESOURCE_DIR}" -type d -name "Resources" | head -n 1)

    if [ -n "${RESOURCES_DIR}" ]; then
      # Clear old resources and copy new ones
      rm -rf "${RESOURCES_DIR}"/*
      cp -R "${BUILD_DIR}/"* "${RESOURCES_DIR}/"
      echo "✅ Extension resources updated in ${RESOURCES_DIR}"
    else
      echo "⚠️  Could not find Resources directory. Falling back to full rebuild."
      UPDATE_MODE=false
    fi
  else
    echo "⚠️  Could not find extension directory. Falling back to full rebuild."
    UPDATE_MODE=false
  fi
fi

if [ "$UPDATE_MODE" = false ]; then
  echo ""
  echo "📦 Running safari-web-extension-packager..."
  echo "   Bundle ID: ${BUNDLE_ID}"
  echo "   App Name:  ${APP_NAME}"
  echo ""

  xcrun safari-web-extension-packager \
    "${BUILD_DIR}" \
    --app-name "${APP_NAME}" \
    --bundle-identifier "${BUNDLE_ID}" \
    --swift \
    --macos-only \
    --copy-resources \
    --force \
    --no-open

  # Find the generated Xcode project
  XCODE_PROJECT=$(find "${SCRIPT_DIR}" -maxdepth 2 -name "*.xcodeproj" -type d | head -n 1)

  if [ -z "${XCODE_PROJECT}" ]; then
    echo ""
    echo "⚠️  Could not auto-detect the generated Xcode project."
    echo "   It may have been created in a subdirectory. Check: ${SCRIPT_DIR}"
    exit 1
  fi

  PROJECT_NAME=$(basename "${XCODE_PROJECT}" .xcodeproj)
  PROJECT_DIR=$(dirname "${XCODE_PROJECT}")

  echo ""
  echo "✅ Safari Xcode project created!"
  echo ""
  echo "📁 Project location: ${XCODE_PROJECT}"
  echo ""
fi

# ─── 5. Print next steps ────────────────────────────────────────────────────

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  下一步操作 / Next Steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. 打开 Xcode 项目:"
if [ -n "${XCODE_PROJECT}" ]; then
  echo "   open \"${XCODE_PROJECT}\""
else
  echo "   open \"${PROJECT_DIR}\""
fi
echo ""
echo "2. 配置签名 (Signing & Capabilities):"
echo "   - 在 Xcode 左侧选择项目 ${PROJECT_NAME}"
echo "   - 选择 TARGET → ${PROJECT_NAME} → Signing & Capabilities"
echo "   - 选择你的 Apple Developer Team"
echo ""
echo "3. 构建并运行:"
echo "   - 点击 Xcode 的 Run 按钮 (▶)"
echo "   - 这会启动一个宿主 App 并在 Safari 中加载扩展"
echo ""
echo "4. 在 Safari 中启用扩展:"
echo "   - 打开 Safari → 设置 → 扩展"
echo "   - 勾选 \"Tab Out\""
echo "   - 如果看不到，先启用开发者模式:"
echo "     Safari → 设置 → 高级 → 勾选 '在菜单栏中显示开发菜单'"
echo "     然后: 开发 → 允许未签名的扩展"
echo ""
echo "5. 使用扩展:"
echo "   - 点击 Safari 工具栏上的 Tab Out 图标"
echo "   - 即可看到标签页仪表盘"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
