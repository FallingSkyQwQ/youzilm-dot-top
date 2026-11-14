import type { ReactNode } from "react";

type Props = {
  title: string;
  meta?: ReactNode;
  description?: ReactNode;
};

export function PageHeader({ title, meta, description }: Props) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {meta ? <p className="page-header__meta">{meta}</p> : null}
      {description ? <p className="page-header__description">{description}</p> : null}
      <hr />
    </header>
  );
}
