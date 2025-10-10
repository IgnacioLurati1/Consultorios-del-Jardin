import "./Marquee.css";

import img1 from "../../../../assets/HomePhotos/HomeOfficesPhotos/office1.jpg";
import img2 from "../../../../assets/HomePhotos/HomeOfficesPhotos/office2.jpg";
import img3 from "../../../../assets/HomePhotos/HomeOfficesPhotos/office3.jpg";
import img4 from "../../../../assets/HomePhotos/HomeOfficesPhotos/office4.jpg";

const images = [
  { src: img1, caption: "Nutrición" },
  { src: img2, caption: "Psicología" },
  { src: img3, caption: "Psicopedagogía" },
  { src: img4, caption: "particulares" },
];

const repeatedImages = Array(300).fill(images).flat();

export function Marquee() {
  return (
    <div className="marquee-container">
      <div className="marquee-track">
        {repeatedImages.map((img, index) => (
          <div className="marquee-item" key={index}>
            <img src={img.src} alt={img.caption} />
            <p className="caption">{img.caption}</p>
          </div>
        ))}
      </div>
    </div>
  );
}