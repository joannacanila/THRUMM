import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "THRUMM — feel every frequency",
  description: "AI reads your mood and builds the perfect playlist",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}