import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

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
    <html lang="en" className={`dark ${inter.variable}`}>
      <head>
        {/* KaTeX math fonts and CSS */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css"
        />
      </head>
      <body className={`${inter.className} bg-black text-zinc-100 antialiased selection:bg-zinc-800 selection:text-white`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}