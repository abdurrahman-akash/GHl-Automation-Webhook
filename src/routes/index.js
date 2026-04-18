import contactsRoutes from "../modules/contacts/contacts.routes.js";

export function registerRoutes(app) {
  app.use(contactsRoutes);
}
