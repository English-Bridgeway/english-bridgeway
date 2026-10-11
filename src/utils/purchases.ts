import { storage } from "./storage";

// Courses bought on this device (order ids confirmed paid by the server). Student
// accounts will replace this; until then a purchase unlocks the course in this browser.
const KEY = "english-bridgeway:purchases";

type Purchases = Record<string, string>; // courseId -> orderId

export const getPurchases = () => storage.get<Purchases>(KEY, {});
export const hasPurchased = (courseId: string) => Boolean(getPurchases()[courseId]);
export function recordPurchase(courseId: string, orderId: string) {
  storage.set(KEY, { ...getPurchases(), [courseId]: orderId });
}
export function removePurchase(courseId: string) {
  const { [courseId]: _removed, ...rest } = getPurchases();
  storage.set(KEY, rest);
}
