import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "THRUMM: feel every frequency",
  description: "Pour out your state of mind. THRUMM reads between the lines to curate a soundtrack that hits perfectly.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Content-Security-Policy" content="
          default-src 'self';
          script-src 'self' 'unsafe-inline' 'unsafe-eval';
          style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
          font-src 'self' https://fonts.gstatic.com;
          img-src 'self' data: https://i.scdn.co https://mosaic.scdn.co https://*.mzstatic.com https://*.spotifycdn.com;
          media-src 'self' https://*.scdn.co https://*.spotify.com https://*.mzstatic.com;
          frame-src 'self' https://open.spotify.com;
          connect-src 'self' https://api.anthropic.com https://openrouter.ai https://accounts.spotify.com https://api.spotify.com https://itunes.apple.com;
        ".replace(/\s+/g, " ").trim()} />
      </head>
      <body>{children}</body>
    </html>
  );
}
