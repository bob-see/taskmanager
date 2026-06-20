"use client";

import { useState } from "react";

type UserOption = {
  id: string;
  name: string;
  email: string;
};

type ActivityFiltersProps = {
  users: UserOption[];
  selectedUserId: string;
  selectedPeriod: string;
  customFrom: string;
  customTo: string;
};

const inputClass =
  "tm-input h-10 rounded-[10px] border px-3 text-sm outline-none transition-colors";

export function ActivityFilters({
  users,
  selectedUserId,
  selectedPeriod,
  customFrom,
  customTo,
}: ActivityFiltersProps) {
  const [period, setPeriod] = useState(selectedPeriod);

  return (
    <form className="tm-card mt-5 rounded-[14px] border p-4 shadow-sm md:p-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] xl:items-end">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">User</span>
          <select name="userId" className={`${inputClass} w-full`} defaultValue={selectedUserId}>
            <option value="">All users</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Date range</span>
          <select
            name="period"
            className={`${inputClass} w-full`}
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        <button
          type="submit"
          className="tm-button-primary inline-flex h-10 items-center justify-center rounded-[10px] border px-4 text-sm"
        >
          Apply
        </button>
      </div>

      {period === "custom" ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:max-w-2xl">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">From</span>
            <input
              type="date"
              name="from"
              className={`${inputClass} w-full`}
              defaultValue={customFrom}
              required
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">To</span>
            <input
              type="date"
              name="to"
              className={`${inputClass} w-full`}
              defaultValue={customTo}
              required
            />
          </label>
        </div>
      ) : null}
    </form>
  );
}
