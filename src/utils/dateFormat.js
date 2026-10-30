function parseDate(value) {
  const text = String(value || "").trim();
  let year;
  let month;
  let day;

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const displayMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (isoMatch) {
    [, year, month, day] = isoMatch;
  } else if (displayMatch) {
    [, day, month, year] = displayMatch;
  } else {
    return null;
  }

  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);
  const date = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay));

  if (
    date.getUTCFullYear() !== numericYear ||
    date.getUTCMonth() !== numericMonth - 1 ||
    date.getUTCDate() !== numericDay
  ) {
    return null;
  }

  return {
    iso: `${String(numericYear).padStart(4, "0")}-${String(numericMonth).padStart(2, "0")}-${String(numericDay).padStart(2, "0")}`,
    display: `${String(numericDay).padStart(2, "0")}/${String(numericMonth).padStart(2, "0")}/${String(numericYear).padStart(4, "0")}`,
  };
}

function toDisplayDate(value) {
  const parsed = parseDate(value);
  return parsed ? parsed.display : String(value || "").trim();
}

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

module.exports = {
  parseDate,
  toDisplayDate,
  todayIsoDate,
};
