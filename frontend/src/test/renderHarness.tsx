import { type ReactNode } from "react";
import { StaticRouter } from "react-router-dom";

export function StaticRenderRouter({ children }: { children: ReactNode }) {
  return <StaticRouter location="/">{children}</StaticRouter>;
}
