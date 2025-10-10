import "./Marquee.css";
import img1 from "../../../../assets/HomePhotos/HomeOfficesPhotos/office1.jpg";
import img2 from "../../../../assets/HomePhotos/HomeOfficesPhotos/office2.jpg";
import img3 from "../../../../assets/HomePhotos/HomeOfficesPhotos/office3.jpg";
import img4 from "../../../../assets/HomePhotos/HomeOfficesPhotos/office4.jpg";
import img5 from "../../../../assets/HomePhotos/HomeOfficesPhotos/office5.jpg";

const images = [
  { src: img1, caption: "Pediatría" },
  { src: img2, caption: "Cardiología" },
  { src: img3, caption: "Traumatología" },
  { src: img4, caption: "Neurología" },
  { src: img5, caption: "Ginecología" },
];

export function Marquee() {
  const tripledImages = [...images, ...images, ...images, ...images, ...images, ...images];

  return (
    <div className="marquee-container">
      <div className="marquee-track">
        {tripledImages.map((img, index) => (
          <div className="marquee-item" key={index}>
            <img src={img.src} alt={img.caption} />
            <p className="caption">{img.caption}</p>
          </div>
        ))}
      </div>
    </div>
  );
}