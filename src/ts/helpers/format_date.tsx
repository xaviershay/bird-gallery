export const formatDate = (date: Date): React.ReactNode => {
  const day = date.getUTCDate();
  const month = date.toLocaleString("default", { month: "short", timeZone: "UTC" });
  const year = date.getUTCFullYear();

  const suffix =
    day === 1 || day === 21 || day === 31
      ? "st"
      : day === 2 || day === 22
      ? "nd"
      : day === 3 || day === 23
      ? "rd"
      : "th";

  return (
    <>
      {day}
      <sup>{suffix}</sup> {month + ' ' + year}
    </>
  );
};
