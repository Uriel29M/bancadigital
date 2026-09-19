FROM denoland/deno:2.5.2
WORKDIR /app
COPY gateway ./gateway
RUN deno cache gateway/server.ts
ENV PORT=8080
EXPOSE 8080
CMD ["run","--allow-net","--allow-env","--allow-read","gateway/server.ts"]
