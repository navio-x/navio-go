import { browser } from "wxt/browser";
import { MESSAGE_TYPE } from "@/lib/extensionProtocol.js";

export function getPendingRequest(id) {
  return browser.runtime.sendMessage({ type: MESSAGE_TYPE.GET_PENDING_REQUEST, id });
}

export function resolveRequest(id, result) {
  return browser.runtime.sendMessage({ type: MESSAGE_TYPE.RESOLVE_REQUEST, id, result });
}

export function rejectRequest(id, error) {
  return browser.runtime.sendMessage({ type: MESSAGE_TYPE.REJECT_REQUEST, id, error });
}
