FROM node:lts-alpine

WORKDIR /app
COPY . /app/

ENV PORT=8000
ENV SERVING_PATH=/www

ENTRYPOINT [ "npm", "start" ]