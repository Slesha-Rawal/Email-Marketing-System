import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import "./DateRangeFilter.css";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const toDateValue = (value) => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const toInputDate = (dateValue) => format(dateValue, "yyyy-MM-dd");

function DateRangeFilter({
  menuRef,
  isOpen,
  onToggle,
  selectedLabel,
  isRangeActive,
  dateFrom,
  dateTo,
  onDateRangeChange,
  onClear,
  align = "right",
}) {
  const selectedRange = useMemo(
    () => ({
      from: toDateValue(dateFrom),
      to: toDateValue(dateTo),
    }),
    [dateFrom, dateTo],
  );

  const [displayMonth, setDisplayMonth] = useState(
    selectedRange.to || selectedRange.from || new Date(),
  );

  const currentYear = new Date().getFullYear();
  const startMonth = new Date(currentYear - 10, 0);
  const endMonth = new Date(currentYear + 10, 11);
  const monthIndex = displayMonth.getMonth();
  const displayYear = displayMonth.getFullYear();

  const yearOptions = useMemo(() => {
    const years = [];
    for (let year = currentYear - 10; year <= currentYear + 10; year += 1) {
      years.push(year);
    }
    return years;
  }, [currentYear]);

  const goToPreviousMonth = () => {
    setDisplayMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
    );
  };

  const goToNextMonth = () => {
    setDisplayMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
    );
  };

  useEffect(() => {
    if (selectedRange.to || selectedRange.from) {
      setDisplayMonth(selectedRange.to || selectedRange.from);
    }
  }, [selectedRange.from, selectedRange.to]);

  return (
    <div ref={menuRef} className="relative w-64">
      <button
        type="button"
        onClick={onToggle}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-700 focus:outline-none focus:border-indigo-300 flex items-center justify-between gap-1.5"
      >
        <span className="truncate">{selectedLabel}</span>
        <div className="flex items-center gap-1">
          {isRangeActive && (
            <X
              className="h-4 w-4 text-gray-400 hover:text-gray-600"
              onClick={(event) => {
                event.stopPropagation();
                onClear();
              }}
            />
          )}
          <Calendar className="h-4 w-4 text-gray-500" />
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </div>
      </button>

      {isOpen && (
        <div
          className={`absolute ${align === "left" ? "left-0" : "right-0"} z-30 mt-2 w-80 max-w-[92vw] rounded-md border border-gray-200 bg-[#f3f6fb] p-1.5 shadow-xl`}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-sm border border-gray-200 bg-white px-2 py-1 text-center text-xs font-semibold text-slate-700">
              {selectedRange.from
                ? format(selectedRange.from, "MMM d, yyyy")
                : "Start"}
            </div>
            <div className="rounded-sm border border-indigo-300 bg-white px-2 py-1 text-center text-xs font-semibold text-slate-700 shadow-[0_0_0_1px_rgba(99,102,241,0.2)]">
              {selectedRange.to
                ? format(selectedRange.to, "MMM d, yyyy")
                : "End"}
            </div>
          </div>

          <div className="mt-1.5 rounded-sm border border-gray-200 bg-white p-1.5">
            <div className="contact-rdp-header">
              <button
                type="button"
                onClick={goToPreviousMonth}
                className="contact-rdp-header-nav"
                aria-label="Go to previous month"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              <div className="contact-rdp-header-dropdowns">
                <select
                  value={monthIndex}
                  onChange={(event) => {
                    const nextMonth = Number(event.target.value);
                    setDisplayMonth(new Date(displayYear, nextMonth, 1));
                  }}
                  className="contact-rdp-header-select"
                >
                  {MONTH_NAMES.map((monthName, index) => (
                    <option key={monthName} value={index}>
                      {monthName}
                    </option>
                  ))}
                </select>

                <select
                  value={displayYear}
                  onChange={(event) => {
                    const nextYear = Number(event.target.value);
                    setDisplayMonth(new Date(nextYear, monthIndex, 1));
                  }}
                  className="contact-rdp-header-select"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={goToNextMonth}
                className="contact-rdp-header-nav"
                aria-label="Go to next month"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <DayPicker
              mode="range"
              required={false}
              showOutsideDays
              fixedWeeks
              month={displayMonth}
              onMonthChange={setDisplayMonth}
              selected={selectedRange}
              onSelect={(range) => {
                onDateRangeChange({
                  from: range?.from ? toInputDate(range.from) : "",
                  to: range?.to ? toInputDate(range.to) : "",
                });
              }}
              className="contact-rdp"
              captionLayout="label"
              startMonth={startMonth}
              endMonth={endMonth}
              classNames={{
                months: "contact-rdp-months",
                month: "contact-rdp-month",
                nav: "contact-rdp-hidden",
                button_previous: "contact-rdp-nav-button",
                button_next: "contact-rdp-nav-button",
                month_caption: "contact-rdp-hidden",
                dropdowns: "contact-rdp-dropdowns",
                dropdown: "contact-rdp-dropdown",
                month_grid: "contact-rdp-grid",
                weekdays: "contact-rdp-weekdays",
                weekday: "contact-rdp-weekday",
                week: "contact-rdp-week",
                day: "contact-rdp-day",
                day_button: "contact-rdp-day-button",
                range_start: "contact-rdp-range-start",
                range_middle: "contact-rdp-range-middle",
                range_end: "contact-rdp-range-end",
                selected: "contact-rdp-selected",
                today: "contact-rdp-today",
                outside: "contact-rdp-outside",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default DateRangeFilter;
