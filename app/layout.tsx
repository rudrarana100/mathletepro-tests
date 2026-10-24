import "./globals.css";
// ... your other imports ...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Add this exact line to pull in the official math fonts and structural CSS */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css" />
      </head>
      <body className="bg-black text-white">
        {children}
      </body>
    </html>
  );
}