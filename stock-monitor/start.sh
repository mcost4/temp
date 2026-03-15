#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
BACKEND_PID_FILE="$LOG_DIR/backend.pid"
FRONTEND_PID_FILE="$LOG_DIR/frontend.pid"

mkdir -p "$LOG_DIR"

is_listening() {
    local port="$1"
    lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

start_backend() {
    if is_listening 8000; then
        echo "Backend já está rodando em http://localhost:8000"
        return
    fi

    if [ ! -d "$ROOT_DIR/backend/venv" ]; then
        echo "Ambiente virtual não encontrado em backend/venv. Execute: bash setup.sh"
        exit 1
    fi

    nohup bash -lc "cd '$ROOT_DIR/backend' && source venv/bin/activate && exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload" \
        >"$BACKEND_LOG" 2>&1 &
    echo $! > "$BACKEND_PID_FILE"
    echo "Iniciando backend... logs em $BACKEND_LOG"
}

start_frontend() {
    if is_listening 3000; then
        echo "Frontend já está rodando em http://localhost:3000"
        return
    fi

    nohup bash -lc "cd '$ROOT_DIR/frontend' && exec npm start" \
        >"$FRONTEND_LOG" 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"
    echo "Iniciando frontend... logs em $FRONTEND_LOG"
}

start_backend
start_frontend

echo
echo "Aplicação disponível em http://localhost:3000"
echo "API disponível em http://localhost:8000"
echo "Documentação da API em http://localhost:8000/docs"