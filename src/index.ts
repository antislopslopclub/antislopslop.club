import { serve } from "bun";
import { join } from "node:path";
import index from "./index.html";

const publicDir = join(import.meta.dir, "../public");
const publicFiles = new Bun.Glob("**/*").scanSync({ cwd: publicDir, onlyFiles: true });
const assets = Object.fromEntries(Array.from(publicFiles, name => [
  `/${name}`, new Response(Bun.file(join(publicDir, name))),
]));

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,
    ...assets,
    "/apple-touch-icon-precomposed.png": new Response(null, { status: 404 }),

    "/api/hello": {
      GET() {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      PUT() {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": (req) => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
