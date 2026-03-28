import React, { useEffect, useRef, useState } from "react";
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsRight,
} from "lucide-react";

const Pagination = ({ tableRef, options = [15, 30, 50] }) => {
  const normalizedOptions = options.length > 0 ? options : [15, 30, 50];
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(normalizedOptions[0]);
  const [totalRows, setTotalRows] = useState(0);
  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);
  const sizeMenuRef = useRef(null);

  // Function to update visibility of rows
  const updateTableRows = () => {
    if (!tableRef || !tableRef.current) return;

    const tbody = tableRef.current.querySelector("tbody");
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll("tr")).filter((row) => {
      // Don't count "No users found" row if it exists
      return (
        !row.textContent.includes("No marketing users found") &&
        !row.textContent.includes("No sent campaigns found") &&
        !row.textContent.includes("No scheduled campaigns")
      );
    });

    setTotalRows(rows.length);

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;

    rows.forEach((row, index) => {
      if (index >= startIndex && index < endIndex) {
        row.style.display = "";
      } else {
        row.style.display = "none";
      }
    });

    // Handle "No rows found" specifically if it's there
    const emptyRow = Array.from(tbody.querySelectorAll("tr")).find(
      (row) =>
        row.textContent.includes("No marketing users found") ||
        row.textContent.includes("No sent campaigns found"),
    );
    if (emptyRow) {
      emptyRow.style.display = rows.length === 0 ? "" : "none";
    }
  };

  // Re-paginate when page, rowsPerPage, or target table content changes
  useEffect(() => {
    updateTableRows();
  }, [currentPage, rowsPerPage, tableRef]);

  // Observe table content changes to update pagination
  useEffect(() => {
    if (!tableRef || !tableRef.current) return;

    const tbody = tableRef.current.querySelector("tbody");
    if (!tbody) return;

    const observer = new MutationObserver(() => {
      updateTableRows();
    });

    observer.observe(tbody, { childList: true });

    return () => observer.disconnect();
  }, [tableRef, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;

  // Ensure current page is within total pages after totalRows change
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const handleRowsPerPageChange = (nextValue) => {
    setRowsPerPage(nextValue);
    setCurrentPage(1);
    setIsSizeMenuOpen(false);
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        isSizeMenuOpen &&
        sizeMenuRef.current &&
        !sizeMenuRef.current.contains(event.target)
      ) {
        setIsSizeMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isSizeMenuOpen]);

  useEffect(() => {
    if (!normalizedOptions.includes(rowsPerPage)) {
      setRowsPerPage(normalizedOptions[0]);
      setCurrentPage(1);
    }
  }, [normalizedOptions, rowsPerPage]);

  const getPageNumbers = () => {
    const pages = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first, last, current, and 1 either side
      pages.push(1);

      if (currentPage > 3) {
        pages.push("...");
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        if (!pages.includes("...")) pages.push("...");
      }

      if (!pages.includes(totalPages)) pages.push(totalPages);
    }

    return pages;
  };

  if (totalRows === 0 && currentPage === 1) {
    // Still we might want to show it if it needs to read from the table
    // but the target requirements implies it should work with tables.
  }

  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-gray-100 px-4 py-2 mt-0 text-xs rounded-b-xl">
      <div className="flex items-center gap-0.5 text-gray-500">
        <button
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
          className={`h-8 w-8 flex items-center justify-center transition-colors ${
            currentPage === 1
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-500 hover:text-gray-700"
          }`}
          title="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>

        <button
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className={`h-8 w-8 flex items-center justify-center transition-colors ${
            currentPage === 1
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-500 hover:text-gray-700"
          }`}
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {getPageNumbers().map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === "number" && setCurrentPage(page)}
            disabled={page === "..."}
            className={`h-8 min-w-8 px-1 font-medium transition-colors ${
              page === currentPage
                ? "text-indigo-600 font-semibold"
                : page === "..."
                  ? "text-gray-400 cursor-default"
                  : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() =>
            setCurrentPage((prev) => Math.min(totalPages, prev + 1))
          }
          disabled={currentPage === totalPages}
          className={`h-8 w-8 flex items-center justify-center transition-colors ${
            currentPage === totalPages
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-500 hover:text-gray-700"
          }`}
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <button
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
          className={`h-8 w-8 flex items-center justify-center transition-colors ${
            currentPage === totalPages
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-500 hover:text-gray-700"
          }`}
          title="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>

      <div ref={sizeMenuRef} className="relative">
        <button
          type="button"
          onClick={() => setIsSizeMenuOpen((prev) => !prev)}
          className="inline-flex min-w-14 items-center justify-between gap-1.5 rounded-lg border border-transparent px-2 py-1 text-xs font-semibold text-gray-600 transition-colors hover:text-gray-700 focus:outline-none"
        >
          <span>{rowsPerPage}</span>
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </button>

        {isSizeMenuOpen && (
          <div className="absolute right-0 bottom-full z-20 mb-2 w-24 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-lg">
            {normalizedOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleRowsPerPageChange(option)}
                className={`w-full rounded-xl px-2 py-1.5 text-center text-2xl transition-colors ${
                  rowsPerPage === option
                    ? "bg-stone-100 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Pagination;
