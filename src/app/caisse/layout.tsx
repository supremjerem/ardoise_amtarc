import { ToastProvider } from "./toast";

/*
 * The till's shell. Its only job is to make the toast available to every
 * screen under /caisse, so an action confirms itself wherever it was fired.
 */
export default function TillLayout({ children }: LayoutProps<"/caisse">) {
  return <ToastProvider>{children}</ToastProvider>;
}
