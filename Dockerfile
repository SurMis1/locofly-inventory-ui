# build stage
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# run stage
FROM node:18-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY server.js .
RUN npm install express
EXPOSE 8080
CMD ["node", "server.js"]
