import { Link } from "react-router-dom";

// ======= Carousel Arrows =======

export const LeftArrow = () => (
  <svg
    width="36"
    height="36"
    viewBox="0 0 24 24"
    fill="none"
    stroke="black"
    strokeWidth="4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="16 20 8 12 16 4" />
  </svg>
);

export const RightArrow = () => (
  <svg
    width="36"
    height="36"
    viewBox="0 0 24 24"
    fill="none"
    stroke="black"
    strokeWidth="4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="8 20 16 12 8 4" />
  </svg>
);

// ======= Presentation Card =======

interface PresentationCardProps {
  to: string;
  image: string;
  title: string;
}

export function PresentationCard({ to, image, title }: PresentationCardProps) {
  return (
    <Link to={to} className="card-link">
      <div className="card">
        <img src={image} alt={title} />
        <h3>{title}</h3>
      </div>
    </Link>
  );
}
