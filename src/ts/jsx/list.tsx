import { PageListData } from "../types";

export const List = (data: PageListData) => {
  const scriptContent = `
    console.log("hi");
    console.log("/firsts.json?${data.filter.toQueryString()}.json");
    initMap("/firsts.json?${data.filter.toQueryString()}");
  `;

  return (
    <>
      <div id='map'></div>
      <table className='bird-list'>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>First Seen</th>
          </tr>
        </thead>
        <tbody>
          {data.observations.map((o, index) => (
            <tr key={o.id}>
              <td>{data.observations.length - index}</td>
              <td>{o.name}</td>
              <td>{o.seenAt.toISOString().split("T")[0]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <script src="/js/map.js"></script>
      <script dangerouslySetInnerHTML={{ __html: scriptContent }}></script>
    </>
  );
};
