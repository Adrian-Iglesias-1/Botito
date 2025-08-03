FROM node:20

# Instala dependencias necesarias para Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libgbm1 \
    libasound2 \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libxss1 \
    lsb-release \
    xdg-utils

WORKDIR /app
COPY . .

RUN npm install

CMD ["npm", "start"]