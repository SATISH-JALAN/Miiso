#!/bin/bash
# Installer script for Heimdall-rs Decompiler
# Runs on Linux/macOS. For Windows, install WSL or compile via cargo.

echo "⚙️ Miiso: Setting up Heimdall-rs decompiler..."

# 1. Install Rust if not already present
if ! command -v cargo &> /dev/null; then
    echo "🦀 Rust toolchain not found. Installing via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo "🦀 Rust toolchain already installed."
fi

# 2. Clone and install Heimdall-rs
if ! command -v heimdall &> /dev/null; then
    echo "📦 Compiling Heimdall-rs from source..."
    cargo install --git https://github.com/jonasbostrom/heimdall-rs --locked
    echo "✅ Heimdall-rs installed successfully!"
else
    echo "✅ Heimdall-rs is already installed."
fi

heimdall --version
