import React from "react";
import { HeaderStats } from "../model/header_stats";
import { APP_TITLE, TRACKING_START_DATE, EXTERNAL_SERVICES } from "../config/constants";

export interface OpenGraphMetadata {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  oEmbedUrl?: string;
}

interface LayoutViewProps {
  title: string,
  content: React.ReactNode,
  header: HeaderStats,
  ogMetadata?: OpenGraphMetadata
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
        <link
          rel="stylesheet"
          href={EXTERNAL_SERVICES.FONT_AWESOME}
        />
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
        {props.ogMetadata && (
          <>
            {props.ogMetadata.title && <meta property="og:title" content={props.ogMetadata.title} />}
            {props.ogMetadata.description && <meta property="og:description" content={props.ogMetadata.description} />}
            {props.ogMetadata.image && <meta property="og:image" content={props.ogMetadata.image} />}
            {props.ogMetadata.url && <meta property="og:url" content={props.ogMetadata.url} />}
            {props.ogMetadata.type && <meta property="og:type" content={props.ogMetadata.type} />}
            {props.ogMetadata.image && <meta name="twitter:card" content="summary_large_image" />}
            {props.ogMetadata.title && <meta name="twitter:title" content={props.ogMetadata.title} />}
            {props.ogMetadata.description && <meta name="twitter:description" content={props.ogMetadata.description} />}
            {props.ogMetadata.image && <meta name="twitter:image" content={props.ogMetadata.image} />}
            {props.ogMetadata.oEmbedUrl && <link rel="alternate" type="application/json+oembed" href={props.ogMetadata.oEmbedUrl} />}
          </>
        )}
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
