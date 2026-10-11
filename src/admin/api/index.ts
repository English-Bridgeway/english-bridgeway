import { isLive } from "../../utils/backend";
import { httpApi } from "./http";
import { localApi } from "./local";

export const adminApi = isLive ? httpApi : localApi;
export * from "./types";
