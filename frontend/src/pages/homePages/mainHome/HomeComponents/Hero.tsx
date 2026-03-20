import "./Hero.css";
import homeImg from "../../../../assets/HomePhotos/home.jpg";

export function Hero() {
  return (
    <div
      className="home-container"
      style={{ backgroundImage: `url(${homeImg})` }}
    >
      <div className="text-container">
        <div className="text-blur-bg" />
        <h1 className="titleHome">Consultorios del Jardín</h1>
        <p className="subtitleHome">
          Nuestros mejores lugares para los mejores profesionales
        </p>
      </div>
    </div>
  );
}