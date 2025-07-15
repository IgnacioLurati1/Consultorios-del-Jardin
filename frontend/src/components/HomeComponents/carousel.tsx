// carousel.tsx

const LeftArrow = () => (
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

const RightArrow = () => (
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

export { LeftArrow, RightArrow };
