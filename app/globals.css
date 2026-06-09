@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #f4f6fb;
  --foreground: #0f172a;
  /* Gráficos (Recharts lê via var()) */
  --chart-grid: #f1f5f9;
  --chart-axis: #64748b;
  --chart-tooltip-bg: #ffffff;
  --chart-tooltip-border: #e2e8f0;
  --chart-tooltip-text: #0f172a;
  --scrollbar-thumb: #cbd5e1;
  --scrollbar-thumb-hover: #94a3b8;
}

.dark {
  --background: #0b1120;
  --foreground: #e2e8f0;
  --chart-grid: #1e293b;
  --chart-axis: #94a3b8;
  --chart-tooltip-bg: #1e293b;
  --chart-tooltip-border: #334155;
  --chart-tooltip-text: #e2e8f0;
  --scrollbar-thumb: #334155;
  --scrollbar-thumb-hover: #475569;
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
}

body {
  background: var(--background);
  color: var(--foreground);
  -webkit-font-smoothing: antialiased;
}

* {
  box-sizing: border-box;
}

/* Scrollbar discreta */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 6px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

@layer components {
  .card {
    @apply rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900;
  }
  .btn {
    @apply inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed;
  }
  .btn-primary {
    @apply btn bg-brand-600 text-white hover:bg-brand-700;
  }
  .btn-secondary {
    @apply btn border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700;
  }
  .btn-danger {
    @apply btn bg-red-600 text-white hover:bg-red-700;
  }
  .input {
    @apply w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-brand-900/40;
  }
  .label {
    @apply mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300;
  }
  .badge {
    @apply inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium;
  }
}
