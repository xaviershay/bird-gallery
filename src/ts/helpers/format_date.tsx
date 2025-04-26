export const formatDate = (date: Date): React.ReactNode => {
  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();

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
      <sup>{suffix}</sup> {month} {year}
    </>
  );
};
