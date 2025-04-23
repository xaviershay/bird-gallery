import React from "react";
import { ListType, PageLayout } from "../types";
import { Filter } from '../model/filter';

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
    const newFilter = new Filter(
      filterChange.type ?? page.filter.type,
      filterChange.region ?? page.filter.region,
      filterChange.period ?? page.filter.period
    );
    if (objectEqual(newFilter, page.filter)) {
      return <span>{text}</span>;
    } else {
      const queryString = newFilter.toQueryString();
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
