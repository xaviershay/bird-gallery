import { PageListData } from "../types";

export const List = (data: PageListData) => (
  <div>
    <table>
      {data.observations.map((o) => (
        <tr>
          <td>{o.name}</td>
          <td>{o.createdAt.toISOString().split("T")[0]}</td>
        </tr>
      ))}
    </table>
  </div>
);
