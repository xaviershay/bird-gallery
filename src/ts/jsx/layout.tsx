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
        <meta
          name="viewport"
          content="initial-scale=1,maximum-scale=1,user-scalable=no"
        />
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.css"
          rel="stylesheet"
        />
        <script src="https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.js"></script>
        <link rel="stylesheet" href="/css/custom.css" />
      </head>
      <body>
        <h1>Xavier&apos;s Bird Lists</h1>
        {page.content}
      </body>
    </html>
  );
};
