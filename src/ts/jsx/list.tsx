import { PageListData } from "../types";

export const List = (data: PageListData) => <>
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
</>
;
