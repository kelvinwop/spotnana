import { Elysia } from "elysia";
import { authRoutes } from "./v1/auth";
import { chatRoutes } from "./v1/chat";

export const routes = new Elysia().use(authRoutes).use(chatRoutes);
