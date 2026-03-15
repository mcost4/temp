# 🚀 Guia Rápido de Início

## ⚡ Execução Rápida em 5 Minutos

### 0. Subir tudo com 1 comando
```bash
cd stock-monitor
bash start.sh
```

Ou, se preferir:
```bash
cd stock-monitor
npm start
```

- 🌐 **Frontend**: http://localhost:3000
- 📡 **API**: http://localhost:8000
- 📚 **Documentação API**: http://localhost:8000/docs

Os processos ficam em background e os logs são salvos em `logs/backend.log` e `logs/frontend.log`.

### 1. Setup Automático
```bash
bash setup.sh
```

### 2. Editar API Key (Opcional)
```bash
# Editar arquivo .env
nano backend/.env

# Ou apenas usar dados de exemplo (sem API key)
```

Para configurar fonte de Dividend Y```bash
# backend/.env
DY_DATA_SOURCE=alpha_vantage  # alpha_vantage | finnhub | yahoo_finance
```

Se escolher Finnhub, configure também:
```bash
FINNHUB_API_KEY=sua_chave_finnhub
```

### 3. Executar Backend
```bash
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Output esperado:**
```
INFO:     Started reloader process
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 4. Em outro terminal, executar Frontend
```bash
cd frontend
npm start
```

**Output esperado:**
```
VITE vX.X.X ready in ...ms
➜  Local:   http://localhost:3000/
```

Se estiver em dev container/Codespaces e o browser não recarregar sozinho,
reabra a aba do app após reiniciar o `npm start` para reconectar o canal HMR.

### 5. Acessar aplicativo
- 🌐 **Frontend**: http://localhost:3000
- 📡 **API**: http://localhost:8000
- 📚 **Documentação API**: http://localhost:8000/docs

---

## 🐳 Com Docker (1 Comando)

```bash
docker-compose up
```

Acesse: http://localhost:3000

---

## 🔑 Usando com API Key Real

### 1. Obter API Key Grátis
- Acesse: https://www.alphavantage.co/api/
- Registre-se
- Copie sua API Key

Opcional (Finnhub):
- Acesse: https://finnhub.io/
- Crie uma conta e gere sua API key

### 2. Configurar
**Opção A - Via Interface Web:**
- Cole a chave no campo de input do aplicativo
- Clique "Salvar"

**Opção B - Via Arquivo .env:**
```bash
# backend/.env
ALPHA_VANTAGE_API_KEY=sua_chave_aqui
```

### 3. Reiniciar Backend
Pare o servidor (Ctrl+C) e execute novamente:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Os dados virão da API Alpha Vantage em tempo real!

---

## 📊 Personalizar Ações

Edite o arquivo `backend/.env`:
```bash
STOCKS=AAPL,MSFT,TSLA,GOOGL
```

Reinicie o backend para aplicar as mudanças.

---

## 🆘 Troubleshooting

### Erro: "Não consegue conectar ao backend"
```bash
# Verifique se o backend está rodando
curl http://localhost:8000/health

# Se não responder, reinicie:
cd backend && python main.py
```

### API Key "Inválida"
```bash
# Gere uma nova em https://www.alphavantage.co/api/
# Aguarde alguns minutos para ativar
# Teste diretamente:
curl "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=NVDA&apikey=SUA_CHAVE"
```

### Erro de CORS
- ✅ Já está configurado corretamente
- Se persistir, tente usar Docker

---

## 📱 Interface do Aplicativo

```
┌─────────────────────────────────┐
│      📈 STOCK MONITOR           │
│  Monitore cotações em tempo real │
├─────────────────────────────────┤
│ [Sua API Key...] [Salvar] [Help]│
├─────────────────────────────────┤
│ [🔄 Atualizar Agora] [Auto-ref] │
├─────────────────────────────────┤
│ ✅ Dados em tempo real           │
├─────────────────────────────────┤
│
│  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  │  FTNT    │  │  PANW    │  │  CRWD    │
│  │  $83.40  │  │ $327.15  │  │ $362.80  │
│  │ ↑ +1.18% │  │ ↓ -0.64% │  │ ↑ +2.45% │
│  │ DY:  N/D │  │ DY:  N/D │  │ DY:  N/D │
│  └──────────┘  └──────────┘  └──────────┘
│
│  ┌──────────┐  ┌──────────┐
│  │   ZS     │  │  CHKP    │
│  │ $212.35  │  │ $176.90  │
│  │ ↑ +0.92% │  │ ↓ -0.48% │
│  │ DY:  N/D │  │ DY:  N/D │
│  └──────────┘  └──────────┘
│
└─────────────────────────────────┘
```

---

## 🎯 Próximos Passos

1. **Configurar Auto-atualização**
   - Marque "Auto-atualizar" para atualizar a cada 60s

2. **Deploy na Nuvem**
   - Execute: `bash deploy.sh`
   - Siga as instruções para sua plataforma (Render, AWS, Heroku)

3. **Adicionar mais ações**
   - Edite `STOCKS` no arquivo `.env`
   - Suporte padrão: NVDA, GE, CVX, CCJ, SQM, PLTR, MARA, LLY, WMT, FTNT, PANW, CRWD, ZS, CHKP

4. **Melhorias futuras**
   - Adicionar gráficos
   - Histórico de cotações
   - Alertas de preço
   - Carteira personalizada

---

## 📞 Suporte

| Problema | Solução |
|----------|---------|
| Backend não inicia | Verifique Python 3.10+ |
| Frontend não carrega | Verifique http://localhost:3000 |
| Dados não atualizam | Reinicie backend com `.env` correto |
| API Key falha | Gere nova em alphavantage.co |

---

**Desenvolvido com ❤️ — Stock Monitor 2026**
