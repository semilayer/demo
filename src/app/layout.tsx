import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'SemiLayer Live Demo — semantic search + typed query, no backend',
  description:
    'A bare-bones HTML page calling SemiLayer over plain HTTP. Search and query a 500-row product fixture, with timing and pagination — no SDK, no backend.',
  openGraph: {
    title: 'SemiLayer Live Demo',
    description:
      'Search and query a Postgres dataset with zero backend code — just fetch() against the SemiLayer API.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google Tag Manager */}
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-TXMV987S');`}
        </Script>
        {/* End Google Tag Manager */}
      </head>
      <body>{children}</body>
    </html>
  )
}
