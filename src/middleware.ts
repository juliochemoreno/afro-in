import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware((context, next) => {
  const url = new URL(context.request.url);

  // 1. Redirigir www a non-www
  if (url.hostname.startsWith("www.")) {
    const newHostname = url.hostname.replace("www.", "");
    const newUrl = new URL(context.request.url);
    newUrl.hostname = newHostname;
    newUrl.protocol = "https:"; // Aseguramos HTTPS en el redirect

    return context.redirect(newUrl.toString(), 301);
  }

  // 2. (Opcional) Forzar HTTPS si no estamos en localhost
  // Nota: Cloudflare suele manejar esto en el borde ("Always Use HTTPS"), 
  // pero esto es un refuerzo. Evitamos hacerlo en localhost.
  if (url.protocol === "http:" && !url.hostname.includes("localhost") && !url.hostname.includes("127.0.0.1")) {
    const newUrl = new URL(context.request.url);
    newUrl.protocol = "https:";
    return context.redirect(newUrl.toString(), 301);
  }

  return next();
});
