# Build stage compiles the Vite app with env baked in, for a static bundle
FROM node:20-alpine AS build
WORKDIR /app

# Build-time public config (Vite inlines VITE_* at build)
ARG VITE_SOCKET_URL
ARG VITE_STUN_URL
ARG VITE_TURN_URL
ARG VITE_TURN_USERNAME
ARG VITE_TURN_CREDENTIAL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL \
    VITE_STUN_URL=$VITE_STUN_URL \
    VITE_TURN_URL=$VITE_TURN_URL \
    VITE_TURN_USERNAME=$VITE_TURN_USERNAME \
    VITE_TURN_CREDENTIAL=$VITE_TURN_CREDENTIAL

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Runtime stage serves the static bundle via nginx, for a small production image
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
