import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { and, count, eq, ilike, asc, like, sql } from "drizzle-orm";
import { Hono } from "hono";
import { html } from "hono/html";
import { db } from "./db.js";
import { product } from "./schema.js";
import { generateHTML } from "./template.js";
import esMain from "es-main";

export const start_server = () => {
  const PORT = process.env.PORT || 3000;
  const app = new Hono();

  const itemsPerPage = 10;
  let currentStatus;

  function searchPagination(totalPages, currentPage, query) {
    const links = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === currentPage) {
        links.push(html`<span class="active">${i}</span>`);
      } else {
        links.push(html`
          <a href="/?query=${encodeURIComponent(query)}&page=${i}">${i}</a>
        `);
      }
    }
   return links;
  }

  async function addProduct(name, imageUrl) {
    await db.insert(product).values({
      name: name,
      image_url: imageUrl,
      deleted: false,
    });
  }

  async function deleteProduct(id) {
    await db.update(product).set({ deleted: true }).where(eq(product.id, id));
  }

  app.get("/public/*", serveStatic({ root: "./" }));

  app.get("/", async (c) => {

    let products= db.select().from(product).where(sql`${product.deleted} = false`).all();
    console.log(products.length);
    const currentPage = parseInt(c.req.query('page') || 1);
    const querySearch = c.req.query('query') || "";
    if (querySearch) {
      products = db.select().from(product).where(like(product.name,`%${querySearch}%`)).all();
    } 
    
    let totalPages = Math.ceil(
      ( db.select({ count: count() }).from(product).where(eq(product.deleted, 0))).values()/itemsPerPage
    );

    let currentProducts= products.slice((currentPage-1)*itemsPerPage, currentPage * itemsPerPage);
    
    return c.html(
      generateHTML(
        {
          title: "Store",
          products: currentProducts,
          paginationLinks: searchPagination(totalPages, currentPage, querySearch),
          status: currentStatus,
          query: "",
        }
      )
    );
  });

  // Delete a product
  app.post("/delete", async (c) => {
    const body = await c.req.parseBody();
    const productID = body.productID;
    deleteProduct(productID)
    currentStatus= "Product ID: " + productID + " marked as deleted";
    return c.redirect('/');
  });

  // Create a new product
  app.post("/add", async (c) => {
    const body = await c.req.parseBody();
    const name = body.name;
    const imageUrl = body.image_url;
    addProduct(name, imageUrl)
    return c.redirect('/');
  });

  serve({ fetch: app.fetch, port: PORT });
  console.log(`Server is running at http://localhost:${PORT}`);
  return app;
};

if (esMain(import.meta)) {
  start_server();
}
