import { useEffect } from 'react';

const OVERLAY_SELECTOR = 'dialog[open], .fixed.inset-0:not(.pointer-events-none)';

/**
 * Bloquea el desplazamiento del fondo cuando cualquier modal (<dialog open>)
 * o menú/overlay (.fixed.inset-0) está abierto, manteniendo la posición de scroll.
 */
export function useModalScrollLock(): void {
  useEffect(() => {
    let isLocked = false;
    let savedScrollY = 0;

    const lock = () => {
      if (isLocked) return;
      savedScrollY = window.scrollY || window.pageYOffset || 0;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
      isLocked = true;
    };

    const unlock = () => {
      if (!isLocked) return;
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      isLocked = false;
      window.scrollTo(0, savedScrollY);
    };

    const syncLockState = () => {
      const hasOpenOverlay = Boolean(document.querySelector(OVERLAY_SELECTOR));
      if (hasOpenOverlay) {
        lock();
      } else {
        unlock();
      }
    };

    syncLockState();

    const observer = new MutationObserver(syncLockState);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open', 'class'],
    });

    return () => {
      observer.disconnect();
      unlock();
    };
  }, []);
}
