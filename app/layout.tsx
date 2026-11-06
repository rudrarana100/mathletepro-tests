import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: {
    default: "Mathlete Pro Gym | Advanced Mathematics Examination Platform",
    template: "%s | Mathlete Pro Gym",
  },
  description: "Online test series and competitive examination portal for advanced mathematics.",
  metadataBase: new URL("http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* KaTeX math fonts and CSS */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css"
        />
      </head>
      <body className="bg-black text-white antialiased selection:bg-zinc-800 selection:text-white">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}