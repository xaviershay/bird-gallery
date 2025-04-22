import React from "react";
import { Filter, ListType, PageLayout } from "../types";

// Utility function for shallow equality checking
const objectEqual = (obj1: Record<string, any>, obj2: Record<string, any>): boolean => {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  return keys1.every(key => obj2.hasOwnProperty(key) && obj1[key] === obj2[key]);
};

type PartialFilter = {
  type?: ListType,
  region?: string | null,
  period?: string | null
}

export const Layout = (page: PageLayout) => {
  const navLink = (text: string, filterChange: PartialFilter): React.ReactNode => {
    const newFilter = { ...page.filter, ...filterChange };
    if (objectEqual(newFilter, page.filter)) {
      return <span>{text}</span>;
    } else {

      var parts : any = {}
      switch(newFilter.type) {
        case ListType.List: parts.type = 'list'; break;
        case ListType.Photos: parts.type = 'photos'; break;
        default: throw new Error("Unsupported type")
      }

      if (newFilter.region == null) {
        parts.region = 'world'
      } else {
        parts.region = newFilter.region
      }

      if (newFilter.period == null) {
        parts.period = "life";
      } else {
        parts.period = newFilter.period;
      }

      const queryString = new URLSearchParams(parts).toString();
      const url = `?${queryString}`;

      return <a href={url}>{text}</a>;
    }
  };

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
        <nav>
          <section>
            <strong>List</strong>
            <ul>
              <li>{navLink("Seen", { type: ListType.List })}</li>
              <li>{navLink("Photoed", { type: ListType.Photos })}</li>
            </ul>
          </section>

          <section>
            <strong>Region</strong>
            <ul>
              <li>{navLink("World", { region: null })}</li>
              <li>{navLink("Victora", { region: "au-vic"})}</li>
            </ul>
          </section>

          <section>
            <strong>Time Period</strong>
            <ul>
              <li>{navLink("Life", { period: null })}</li>
              <li>{navLink("2025", { period: "2025" })}</li>
            </ul>
          </section>
        </nav>
        {page.content}
      </body>
    </html>
  );
};
