import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { FiX } from 'react-icons/fi';

type BaseModalProps = {
  labelledBy: string;
  children: ReactNode;
  className?: string;
  onClose: () => void;
};

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function useModalLifecycle<T extends HTMLElement>(onClose: () => void) {
  const modalRef = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const modal = modalRef.current;
      if (!modal) return;

      const focusableElements = Array.from(
        modal.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);

      if (!focusableElements.length) {
        event.preventDefault();
        modal.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.setTimeout(() => {
      const preferredFocusable = modalRef.current?.querySelector<HTMLElement>('[autofocus], [data-autofocus="true"]');
      const firstFocusable = modalRef.current?.querySelector<HTMLElement>(focusableSelector);
      (preferredFocusable ?? firstFocusable ?? modalRef.current)?.focus();
    }, 0);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  return modalRef;
}

function ModalShell({ labelledBy, children, className = 'decision-modal', onClose }: BaseModalProps) {
  const modalRef = useModalLifecycle<HTMLElement>(onClose);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={modalRef}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close-button" aria-label="Close modal" onClick={onClose}>
          <FiX />
        </button>
        {children}
      </section>
    </div>
  );
}

export function Modal(props: BaseModalProps) {
  return <ModalShell {...props} />;
}

export function FormModal({
  labelledBy,
  children,
  className = 'decision-modal form-modal',
  onClose,
  onSubmit,
}: BaseModalProps & { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const modalRef = useModalLifecycle<HTMLFormElement>(onClose);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        ref={modalRef}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <button type="button" className="modal-close-button" aria-label="Close modal" onClick={onClose}>
          <FiX />
        </button>
        {children}
      </form>
    </div>
  );
}
