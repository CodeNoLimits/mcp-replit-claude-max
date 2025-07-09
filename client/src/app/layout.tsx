import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MCP Replit Claude Max - AI-Powered IDE',
  description: 'Replit-like IDE with Claude Code Max integration for AI-powered development',
  keywords: ['IDE', 'Claude Code', 'AI', 'Development', 'Replit', 'MCP'],
  authors: [{ name: 'CodeNoLimits' }],
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div id="app-root" className="h-screen w-full bg-gray-50">
          {children}
        </div>
      </body>
    </html>
  );
}