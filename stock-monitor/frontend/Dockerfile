FROM node:18-alpine

WORKDIR /app

# Copiar arquivos do frontend
COPY frontend/ .

# Instalar servidor HTTP simples
RUN npm install -g http-server

# Expor porta
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["http-server", "-p", "3000", "--cors"]
