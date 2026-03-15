# Stock Monitor - Aplicativo de Monitoramento de Cotações

Um aplicativo web completo para monitorar cotações de ações da bolsa americana em tempo real. Exibe ticker, preço atual, variação percentual e dividend yield (DY).

## 🎯 Funcionalidades

- ✅ Monitoramento em tempo real de múltiplas ações
- ✅ Exibição de: Ticker, Preço, Variação (% e valor), DY
- ✅ Dashboard interativo e responsivo
- ✅ Auto-atualização configurável
- ✅ Interface moderna com gradientes
- ✅ Dados de exemplo quando API não está disponível
- ✅ Suporte a API Key customizável

## 📊 Ações Monitoradas por Padrão

- **NVDA** - NVIDIA
- **GE** - General Electric
- **CVX** - Chevron
- **FTNT** - Fortinet
- **PANW** - Palo Alto Networks
- **CRWD** - CrowdStrike
- **ZS** - Zscaler
- **CHKP** - Check Point Software

## 🛠️ Stack Tecnológico

### Backend
- **FastAPI** (Python 3.10+)
- **Uvicorn** (servidor ASGI)
- **httpx** (cliente HTTP assíncrono)
- **Alpha Vantage API** (dados de cotações)

### Frontend
- **HTML5** + **CSS3** (sem dependências)
- **JavaScript vanilla** (sem frameworks)
- **LocalStorage** (persistência de dados)
- **Fetch API** (comunicação com backend)

## 🚀 Instalação Local

### Pré-requisitos
- Python 3.10+
- Node.js (opcional, para servidor local de front)
- Git

### Passo 1: Clonar e configurar o Backend

```bash
cd stock-monitor/backend

# Criar ambiente virtual
python3 -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env e adicionar sua API Key da Alpha Vantage
```

### Passo 2: Obter API Key

1. Acesse https://www.alphavantage.co/api/
2. Registre-se e obtenha uma API Key gratuita
3. Cole a chave no campo de entrada do aplicativo OU no arquivo `.env`:

```
ALPHA_VANTAGE_API_KEY=sua_chave_aqui
STOCKS=NVDA,GE,CVX,CCJ,SQM,PLTR,MARA,LLY,WMT,FTNT,PANW,CRWD,ZS,CHKP
UPDATE_INTERVAL=60
```

### Passo 3: Executar Backend

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

O backend estará disponível em: http://localhost:8000

Acessar documentação interativa da API: http://localhost:8000/docs

### Passo 4: Executar Frontend

Em outro terminal:

```bash
cd stock-monitor/frontend
npm start
```

O frontend estará disponível em: http://localhost:3000

Saída esperada do servidor local:

```text
VITE vX.X.X ready in ...ms
➜  Local:   http://localhost:3000/
```

## 🐳 Deploy com Docker

### Build das imagens

```bash
# No diretório raiz do projeto
docker-compose build
```

### Executar com Docker Compose

```bash
docker-compose up
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Documentação API: http://localhost:8000/docs

## ☁️ Deploy na Nuvem

### Opção 1: Render.com (Recomendado - Gratuito)

1. **Push para GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Criar serviço Backend no Render**
   - Conectar repositório
   - Service Type: Web Service
   - Build: `pip install -r requirements.txt`
   - Start: `python main.py`
   - Environment: Adicionar `ALPHA_VANTAGE_API_KEY`

3. **Criar serviço Frontend no Render**
   - Service Type: Static Site
   - Publish directory: `frontend`

### Opção 2: AWS

**Backend (EC2 + Application Load Balancer)**
```bash
# No EC2
cd /home/ubuntu
git clone <seu-repositório>
cd stock-monitor/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
echo "ALPHA_VANTAGE_API_KEY=..." > .env
nohup python main.py &
```

**Frontend (S3 + CloudFront)**
```bash
aws s3 sync frontend/ s3://seu-bucket-name/
```

### Opção 3: Heroku (Descontinuado - considere alternativas)

```bash
heroku create seu-app-name
git push heroku main
heroku config:set ALPHA_VANTAGE_API_KEY=sua_chave
```

## 📡 Endpoints da API

### GET /api/stocks
Retorna dados de todas as ações monitoradas.

**Response:**
```json
{
  "stocks": [
    {
      "ticker": "FTNT",
      "price": 83.40,
      "variation_percent": 1.18,
      "variation_abs": 0.97,
      "dy": null,
      "timestamp": "2024-01-15T10:30:00",
      "status": "success"
    }
  ],
  "last_update": "2024-01-15T10:30:00"
}
```

### GET /api/stocks/{ticker}
Retorna dados de uma ação específica.

**Parameters:**
- `ticker` (string): Símbolo da ação (ex: FTNT)

### GET /health
Health check do servidor.

## 🔐 Variáveis de Ambiente

```
ALPHA_VANTAGE_API_KEY    # Sua chave de API (obtida em alphavantage.co)
STOCKS                   # Lista de ações separadas por vírgula (padrão: NVDA,GE,CVX,CCJ,SQM,PLTR,MARA,LLY,WMT,FTNT,PANW,CRWD,ZS,CHKP)
UPDATE_INTERVAL          # Intervalo de atualização em segundos (padrão: 60)
```

## 📝 Estrutura do Projeto

```
stock-monitor/
├── backend/
│   ├── main.py              # Aplicação FastAPI principal
│   ├── config.py            # Configurações e variáveis de ambiente
│   ├── requirements.txt      # Dependências Python
│   ├── .env.example         # Exemplo de variáveis de ambiente
│   └── Dockerfile           # Configuração Docker
├── frontend/
│   ├── index.html           # Página HTML
│   ├── src/
│   │   ├── style.css        # Estilos CSS
│   │   └── app.js           # Lógica JavaScript
│   ├── package.json         # Metadados do projeto
│   └── Dockerfile           # Configuração Docker
├── docker-compose.yml       # Orquestração de containers
├── README.md                # Este arquivo
└── .gitignore              # Arquivos a ignorar no Git
```

## 🐛 Troubleshooting

### CORS Error
Se receber erro de CORS:
- Certifique-se que o backend está rodando em http://localhost:8000
- Verifique se há proxy configurado no frontend
- No backend, CORS já está configurado para aceitar todas as origens

### API Key não funciona
- Verifique se a chave está ativa em https://alphavantage.co/
- Aguarde alguns minutos para a ativação
- Tente buscar uma ação diretamente: https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=FTNT&apikey=SEU_API_KEY

### Sem dados de DY
O Alpha Vantage não fornece DY diretamente. Para adicionar DY:
1. Integrar com outra fonte de dados (ex: Yahoo Finance, IEX)
2. Usar webscraping com BeautifulSoup
3. Manter um banco de dados local

## 🔄 Próximas Melhorias

- [ ] Adicionar gráficos históricos (Chart.js)
- [ ] Banco de dados para histórico de cotações
- [ ] Alertas de preço (email/SMS)
- [ ] Carteira de investimentos personalizada
- [ ] Comparação entre ações
- [ ] Dark mode
- [ ] Suporte a mais bolsas (B3, Euronext, etc)

## 📄 Licença

MIT

## 💬 Suporte

Para dúvidas sobre Alpha Vantage API:
- https://www.alphavantage.co/documentation/

Para issues do projeto, crie uma issue no GitHub.

---

**Desenvolvido com ❤️**
