import React from "react";
import { HeaderStats } from "../model/header_stats";

interface LayoutViewProps {
  content: React.ReactNode,
  header: HeaderStats
}

export const LayoutView = (props: LayoutViewProps) => {
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
        <link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@700&family=Inter&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="/css/custom.css" />
      </head>
      <body>
    <header>
        <h1><a href="/">Xavier&apos;s Bird Lists</a></h1>
      <p>
        Since 26<sup>th</sup> January 2025 I have{" "}
        <a href="/firsts">seen {props.header.seenCount} different species</a> of wild
        bird, and{" "}
        <a href="/firsts?type=photo">photographed {props.header.photoCount}.</a>
      </p>
      </header>
        {props.content}
      </body>
    </html>
  );
};
