import { useEffect, useRef } from 'react';
import { on, off } from '../lib/socket';

export function useSocket(event, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!event) return undefined;
    const listener = (...args) => {
      if (handlerRef.current) {
        handlerRef.current(...args);
      }
    };
    on(event, listener);
    return () => {
      off(event, listener);
    };
  }, [event]);
}
