import React from "react";

interface PageLayout {
  content: React.ReactNode;
}

export const Layout = (page: PageLayout) => {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <link
          rel="stylesheet"
          href="https://cdn.simplecss.org/simple.min.css"
        />
        <script src="https://kit.fontawesome.com/c9d2c1b382.js" crossOrigin="anonymous"></script>
        <meta
          name="viewport"
          content="initial-scale=1,maximum-scale=1,user-scalable=no"
        />
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.css"
          rel="stylesheet"
        />
        <script src="https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.js"></script>
        <script src="/js/background.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@700&family=Inter&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="/css/custom.css" />
      </head>
      <body>
        <h1><a href="/">Xavier&apos;s Bird Lists</a></h1>
        {page.content}
      </body>
    </html>
  );
};
