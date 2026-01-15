import React from "react";
import { HeaderStats } from "../model/header_stats";
import { APP_TITLE, TRACKING_START_DATE, EXTERNAL_SERVICES } from "../config/constants";

interface LayoutViewProps {
  title: string,
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
          href={EXTERNAL_SERVICES.SIMPLE_CSS}
        />
        <script src={EXTERNAL_SERVICES.FONT_AWESOME} crossOrigin="anonymous"></script>
        <meta
          name="viewport"
          content="initial-scale=1,maximum-scale=1,user-scalable=no"
        />
        <link
          href={EXTERNAL_SERVICES.MAPBOX_CSS}
          rel="stylesheet"
        />
        <script src={EXTERNAL_SERVICES.MAPBOX_JS}></script>
        <link href={EXTERNAL_SERVICES.GOOGLE_FONTS} rel="stylesheet" />
        <link rel="stylesheet" href="/css/custom.css" />
        <link rel="me" href="https://mas.to/@xshay" />
        <title>{props.title}</title>
      </head>
      <body>
    <header>
        <h1><a href="/">{APP_TITLE}</a></h1>
      <p>
        Since {TRACKING_START_DATE} I have{" "}
        <a href="/firsts">seen {props.header.seenCount} different species</a> of wild
        bird, and{" "}
        <a href="/firsts?type=photo">photographed&nbsp;{props.header.photoCount}.</a>
      </p>
      </header>
        {props.content}
      </body>
    </html>
  );
};
