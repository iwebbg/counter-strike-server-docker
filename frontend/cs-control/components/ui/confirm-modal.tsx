"use client";

import { Modal } from "@/components/ui/modal";
import { useI18n } from "@/components/i18n-provider";

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  pending = false,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} eyebrow={t("confirmation")}>
      <p className="modal-copy">{description}</p>
      <footer className="form-actions">
        <button className="button ghost" onClick={() => onOpenChange(false)} disabled={pending}>
          {t("cancel")}
        </button>
        <button className="button danger-button" onClick={onConfirm} disabled={pending}>
          {pending ? t("loading") : confirmLabel || t("confirm")}
        </button>
      </footer>
    </Modal>
  );
}
