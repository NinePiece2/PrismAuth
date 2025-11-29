import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const poppins = Poppins({ weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PrismAuth - OAuth2 Authentication",
  description: "Multi-tenant OAuth2 authentication server",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function getTheme() {
                  const cookies = document.cookie.split('; ');
                  const themeCookie = cookies.find(row => row.startsWith('prismauth-theme='));
                  const savedTheme = themeCookie?.split('=')[1];
                  
                  if (savedTheme === 'dark') {
                    return 'dark';
                  }
                  
                  if (savedTheme === 'light') {
                    return 'light';
                  }
                  
                  if (savedTheme === 'system' || !savedTheme) {
                    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  
                  return 'light';
                }
                
                const theme = getTheme();
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${poppins.className} antialiased`}>
        <ThemeProvider defaultTheme="system" storageKey="prismauth-theme">
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
