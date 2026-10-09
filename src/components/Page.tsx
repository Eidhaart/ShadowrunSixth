import clsx from "clsx";

export function Page({ title, kicker, actions, children, wide }: { title: string; kicker?: string; actions?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={clsx("mx-auto px-4 py-6 md:px-8 md:py-8", wide ? "max-w-[1500px]" : "max-w-6xl")}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
          {kicker && <p className="mt-1 max-w-2xl text-dim">{kicker}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
