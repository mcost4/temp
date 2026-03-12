#!/bin/bash

# Deploy Script para diferentes plataformas

echo "🌐 Stock Monitor - Deploy Guide"
echo "================================"

# Função para AWS
deploy_aws() {
    echo "📦 Preparando deploy para AWS..."
    # Criar zip com código
    zip -r stock-monitor.zip . -x "venv/*" ".venv/*" ".git/*" "__pycache__/*"
    
    echo "✅ Arquivo criado: stock-monitor.zip"
    echo ""
    echo "Próximos passos:"
    echo "1. Upload para AWS Elastic Beanstalk:"
    echo "   aws elasticbeanstalk create-application-version..."
    echo ""
    echo "2. Ou deploy manual em EC2:"
    echo "   - SSH para a instância"
    echo "   - Clone o repositório"
    echo "   - Execute setup.sh"
    echo "   - Rode o backend com supervisor/systemd"
}

# Função para Render
deploy_render() {
    echo "🎨 Deploy para Render.com"
    echo ""
    echo "1. Conecte seu repositório GitHub em: https://dashboard.render.com"
    echo ""
    echo "2. Backend:"
    echo "   - Service Type: Web Service"
    echo "   - Runtime: Python 3"
    echo "   - Build: pip install -r requirements.txt"
    echo "   - Start: cd backend && python main.py"
    echo "   - Env: ALPHA_VANTAGE_API_KEY=sua_chave"
    echo ""
    echo "3. Frontend:"
    echo "   - Service Type: Static Site"
    echo "   - Build: npm install"
    echo "   - Publish Directory: frontend"
    echo ""
}

# Função para Heroku
deploy_heroku() {
    echo "🚀 Deploy para Heroku"
    echo ""
    echo "1. Instale Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli"
    echo ""
    echo "2. Execute:"
    echo "   heroku login"
    echo "   heroku create seu-app-name"
    echo "   git push heroku main"
    echo "   heroku config:set ALPHA_VANTAGE_API_KEY=sua_chave"
    echo ""
}

# Função para Docker
deploy_docker() {
    echo "🐳 Deploy com Docker"
    echo ""
    echo "1. Build das imagens:"
    echo "   docker-compose build"
    echo ""
    echo "2. Execute:"
    echo "   docker-compose up"
    echo ""
    echo "3. Acesse:"
    echo "   - Frontend: http://localhost:3000"
    echo "   - Backend: http://localhost:8000"
    echo "   - API Docs: http://localhost:8000/docs"
    echo ""
}

# Menu
echo "Escolha a plataforma de deploy:"
echo "1) AWS"
echo "2) Render.com (Recomendado)"
echo "3) Heroku"
echo "4) Docker Local"
echo "5) Ver todas as opções"
echo ""
read -p "Digite sua escolha (1-5): " choice

case $choice in
    1) deploy_aws ;;
    2) deploy_render ;;
    3) deploy_heroku ;;
    4) deploy_docker ;;
    5) 
        deploy_aws
        echo ""
        echo "---"
        echo ""
        deploy_render
        echo ""
        echo "---"
        echo ""
        deploy_heroku
        echo ""
        echo "---"
        echo ""
        deploy_docker
        ;;
    *) echo "Opção inválida" ;;
esac
