#!/bin/bash

echo "🚀 Stock Monitor - Setup Script"
echo "================================"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar Python
echo -e "\n${YELLOW}Verificando Python...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python 3 não encontrado!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python encontrado: $(python3 --version)${NC}"

# Setup Backend
echo -e "\n${YELLOW}Configurando Backend...${NC}"
cd backend

# Criar virtual environment
python3 -m venv venv
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Criar .env se não existir
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${YELLOW}✓ Arquivo .env criado${NC}"
    echo -e "${YELLOW}  ⚠️  Edite backend/.env com sua API Key da Alpha Vantage${NC}"
fi

cd ..

echo -e "\n${GREEN}✓ Setup concluído com sucesso!${NC}"

echo -e "\n${YELLOW}Próximos passos:${NC}"
echo "1. Edite backend/.env com sua API Key:"
echo "   - ALPHA_VANTAGE_API_KEY=sua_chave_aqui"
echo ""
echo "2. Execute o Backend:"
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   python main.py"
echo ""
echo "3. Em outro terminal, execute o Frontend:"
echo "   cd frontend"
echo "   python -m http.server 3000"
echo ""
echo "4. Abra no navegador: http://localhost:3000"
