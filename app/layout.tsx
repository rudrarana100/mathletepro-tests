import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mathlete Pro Gym",
  description: "Online Mathematics Practice & Examination",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // We added className="dark" here to permanently lock in your preferred theme
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}