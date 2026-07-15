FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["sh", "-c", "npm run create-table && if [ \"${SEED_DEMO:-false}\" = \"true\" ]; then npm run seed; fi && npm run dev"]
