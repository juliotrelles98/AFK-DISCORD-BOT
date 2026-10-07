#!/bin/bash
# Start the Whisper transcription server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export WHISPER_MODEL="${WHISPER_MODEL:-base}"
export WHISPER_PORT="${WHISPER_PORT:-8787}"

echo "[WHISPER] Starting server with model=$WHISPER_MODEL on port=$WHISPER_PORT"

# Check if dependencies are installed
python3 -c "import faster_whisper" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "[WHISPER] Installing dependencies..."
    pip3 install -r requirements.txt
fi

python3 whisper_server.py
