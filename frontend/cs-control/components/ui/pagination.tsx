"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { useI18n } from "@/components/i18n-provider";

export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useI18n();
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  useEffect(() => {
    if (page !== safePage) onPageChange(safePage);
  }, [onPageChange, page, safePage]);
  const first = totalItems ? (safePage - 1) * pageSize + 1 : 0;
  const last = Math.min(safePage * pageSize, totalItems);
  return (
    <footer className="pagination">
      <span>{t("paginationSummary", { first, last, total: totalItems })}</span>
      <div>
        <button disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} title={t("previousPage")}>
          <ChevronLeft size={16} />
        </button>
        <strong>{t("pageOf", { page: safePage, pages: totalPages })}</strong>
        <button disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)} title={t("nextPage")}>
          <ChevronRight size={16} />
        </button>
      </div>
    </footer>
  );
}
