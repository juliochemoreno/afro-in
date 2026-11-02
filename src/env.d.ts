type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    /** The signed-in admin on /admin pages (set by the middleware). */
    admin?: import("./lib/adminAuth").AdminUser;
  }
}
