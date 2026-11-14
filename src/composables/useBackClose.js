import { watch, onUnmounted } from "vue";
import { pushBackHandler } from "@/lib/backHandlers";

/**
 * While `isOpen()` is true, the hardware back button calls `close` instead
 * of navigating. `close` may decline (a locked sheet): back is then
 * swallowed, the same as tapping its backdrop.
 */
export function useBackClose(isOpen, close) {
  let remove = null;
  const release = () => {
    remove?.();
    remove = null;
  };
  watch(isOpen, (open) => {
    release();
    if (open) remove = pushBackHandler(close);
  }, { immediate: true });
  onUnmounted(release);
}
