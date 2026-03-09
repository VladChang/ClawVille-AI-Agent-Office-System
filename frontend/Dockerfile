# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY shared ./shared
COPY frontend ./frontend
WORKDIR /app/frontend
ARG NEXT_PUBLIC_API_BASE_URL=http://backend:3001/api
ARG NEXT_PUBLIC_WS_URL=ws://backend:3001/ws
ARG NEXT_PUBLIC_RUNTIME_MODE=local
ARG NEXT_PUBLIC_OPERATOR_ID=demo-operator
ARG NEXT_PUBLIC_OPERATOR_ROLE=operator
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_PUBLIC_RUNTIME_MODE=${NEXT_PUBLIC_RUNTIME_MODE}
ENV NEXT_PUBLIC_OPERATOR_ID=${NEXT_PUBLIC_OPERATOR_ID}
ENV NEXT_PUBLIC_OPERATOR_ROLE=${NEXT_PUBLIC_OPERATOR_ROLE}
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app/frontend
ENV NODE_ENV=production
COPY frontend/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/frontend/.next ./.next
COPY --from=build /app/frontend/public ./public
COPY --from=build /app/frontend/next.config.mjs ./next.config.mjs
EXPOSE 3000
CMD ["npm", "start"]
