// cards.tsx

import { Link } from "react-router-dom";

interface PresentationCardProps {
  to: string;
  image: string;
  title: string;
}

const PresentationCard = ({ to, image, title }: PresentationCardProps) => {
  return (
    <Link to={to} className="card-link">
      <div className="card">
        <img src={image} alt={title} />
        <h3>{title}</h3>
      </div>
    </Link>
  );
};

export { PresentationCard };
