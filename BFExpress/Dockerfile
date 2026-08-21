# Étape 1 : build Angular avec Node
FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build -- --configuration=production

# Étape 2 : servir avec Nginx
FROM nginx:alpine
COPY --from=build /app/dist/bfexpress /usr/share/nginx/html
EXPOSE 80
