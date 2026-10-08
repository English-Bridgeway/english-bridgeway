export const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const formatNumber = (n: number) => new Intl.NumberFormat("en-IN").format(n);

export const pluralize = (n: number, word: string, plural = word + "s") => `${n} ${n === 1 ? word : plural}`;
