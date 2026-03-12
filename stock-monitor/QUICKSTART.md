# 🚀 Guia Rápido de Início

## ⚡ Execução Rápida em 5 Minutos

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

### 3. Executar Backend
```bash
cd backend
source venv/bin/activate
python main.py
```

**Output esperado:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 4. Em outro terminal, executar Frontend
```bash
cd frontend
python -m http.server 3000
```

**Output esperado:**
```
Serving HTTP on 0.0.0.0 port 3000
```

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
python main.py
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
│  │  NVDA    │  │   GE     │  │  CVX     │
│  │ $875.50  │  │ $175.30  │  │ $152.75  │
│  │ ↑ +3.45% │  │ ↓ -1.23% │  │ ↑ +2.10% │
│  │ DY: 0.05%│  │ DY: 3.25%│  │ DY: 3.85%│
│  └──────────┘  └──────────┘  └──────────┘
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
   - Suporte: NVDA, GE, CVX, AAPL, MSFT, TSLA, FB, AMZN, BRK.B, JNJ, e +

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
