#!/usr/bin/env bash
set -e

echo ""
echo -e "\033[32m    __                  __ \033[0m"
echo -e "\033[32m   / /_____  ____ _____/ / \033[0m"
echo -e "\033[32m  / __/ __ \/ __ \/ __  /  \033[0m"
echo -e "\033[32m / /_/ /_/ / /_/ / /_/ /   \033[0m"
echo -e "\033[32m \__/\____/\__,_/\__,_/    \033[0m"
echo ""
echo -e "\033[90m  TOAD Declarative Design Language & Compiler\033[0m"
echo -e "\033[90m  https://github.com/razy-me/toad\033[0m"
echo ""

INSTALL_DIR="$HOME/.toad"
BIN_DIR="$INSTALL_DIR/bin"
RUNTIME_DIR="$INSTALL_DIR/runtime"

mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"

NODE_BIN="node"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; then
    if [ -x "$RUNTIME_DIR/bin/node" ]; then
        echo -e "\033[32m✔ Found existing portable Node.js runtime.\033[0m"
        NODE_BIN="$RUNTIME_DIR/bin/node"
    else
        echo -e "\033[36m⬇ Downloading portable Node.js runtime (no root/sudo required)...\033[0m"
        mkdir -p "$RUNTIME_DIR"
        OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
        ARCH="$(uname -m)"
        case "$ARCH" in
            x86_64) ARCH="x64" ;;
            aarch64|arm64) ARCH="arm64" ;;
            *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
        esac
        NODE_VER="v20.18.0"
        NODE_URL="https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-$OS-$ARCH.tar.gz"
        curl -fsSL "$NODE_URL" | tar -xz -C "$RUNTIME_DIR" --strip-components=1
        NODE_BIN="$RUNTIME_DIR/bin/node"
        echo -e "\033[32m✔ Portable Node.js installed.\033[0m"
    fi
else
    echo -e "\033[32m✔ Found system Node.js ($(node -v))\033[0m"
fi

echo -e "\033[36m⬇ Downloading latest TOAD release from GitHub...\033[0m"
curl -fsSL "https://api.github.com/repos/razy-me/toad/tarball/main" | tar -xz -C "$INSTALL_DIR" --strip-components=1

echo -e "\033[36m⚙ Setting up TOAD dependencies...\033[0m"
cd "$INSTALL_DIR"
if [ -x "$RUNTIME_DIR/bin/npm" ]; then
    "$RUNTIME_DIR/bin/npm" install --omit=dev --no-audit --no-fund || true
else
    npm install --omit=dev --no-audit --no-fund || true
fi

# Create launcher script in ~/.toad/bin/toad
cat << 'EOF' > "$BIN_DIR/toad"
#!/usr/bin/env bash
INSTALL_DIR="\C:\Users\flori/.toad"
if [ -x "\/runtime/bin/node" ]; then
    NODE_EXEC="\/runtime/bin/node"
else
    NODE_EXEC="node"
fi
exec "\" "\/dist/cli.js" "\$@"
EOF
chmod +x "$BIN_DIR/toad"

# Check PATH
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    SHELL_RC=""
    if [ -n "$ZSH_VERSION" ] || [ -f "$HOME/.zshrc" ]; then
        SHELL_RC="$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
        SHELL_RC="$HOME/.bashrc"
    elif [ -f "$HOME/.profile" ]; then
        SHELL_RC="$HOME/.profile"
    fi

    if [ -n "$SHELL_RC" ]; then
        echo 'export PATH="\C:\Users\flori/.toad/bin:\"' >> "$SHELL_RC"
        echo -e "\033[32m✔ Added ~/.toad/bin to $SHELL_RC\033[0m"
    fi
fi

echo ""
echo -e "\033[32m============================================================\033[0m"
echo -e "\033[32m  🎉 TOAD was installed successfully!\033[0m"
echo -e "\033[32m============================================================\033[0m"
echo ""
echo -e "  Run TOAD in any terminal:"
echo -e "    \033[36mtoad --help\033[0m"
echo -e "    \033[36mtoad dev\033[0m"
echo -e "    \033[36mtoad update\033[0m"
echo ""
