"use client";

import React from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsSummary } from "@/lib/api";

export function AttendanceTrendChart({ data }: { data: AnalyticsSummary["attendanceTrends"] }) {
  return (
    <div role="img" aria-label={`Attendance over the last ${data.length} days: ${data.map((d) => `${d.date} ${d.present} present, ${d.leave} on leave, ${d.absent} absent`).join("; ")}`} className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar isAnimationActive={false} dataKey="present" name="Present" stackId="a" fill="#3b3bf2" />
          <Bar isAnimationActive={false} dataKey="leave" name="On leave" stackId="a" fill="#ff6b3d" />
          <Bar isAnimationActive={false} dataKey="absent" name="Not in" stackId="a" fill="#d6d3d1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DepartmentChart({ data }: { data: AnalyticsSummary["departmentDistribution"] }) {
  return (
    <div role="img" aria-label={`Headcount by department: ${data.map((d) => `${d.name} ${d.count}`).join(", ")}`} className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar isAnimationActive={false} dataKey="count" name="Headcount" fill="#0e7490" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
