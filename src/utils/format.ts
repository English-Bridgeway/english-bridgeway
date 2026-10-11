export const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const formatNumber = (n: number) => new Intl.NumberFormat("en-IN").format(n);

export const pluralize = (n: number, word: string, plural = word + "s") => `${n} ${n === 1 ? word : plural}`;

export const formatPrice = (rupees: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: rupees % 1 ? 2 : 0 }).format(rupees);

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
