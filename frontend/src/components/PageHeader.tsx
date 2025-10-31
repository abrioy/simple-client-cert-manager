import './PageHeader.css';

type PageHeaderProps = {
  title: string;
  description?: string;
};

export const PageHeader = ({ title, description }: PageHeaderProps) => (
  <header className="page-header">
    <h1>{title}</h1>
    {description ? <p>{description}</p> : null}
  </header>
);
