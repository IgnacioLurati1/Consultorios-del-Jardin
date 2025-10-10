import "./Cards.css"

import moneyImg from "../../../../assets/HomePhotos/HomeCardsPhotos/money.png";
import clockImg from "../../../../assets/HomePhotos/HomeCardsPhotos/clock.png";
import peopleImg from "../../../../assets/HomePhotos/HomeCardsPhotos/people.png";

interface CardProps {
  img: string;
  title: string;
  text: string;
}

const cardsData: CardProps[] = [
  {
    img: moneyImg,
    title: "Pagos presenciales y online",
    text: "Podés abonar de manera presencial, con efectivo o tarjeta, o bien de forma online a través de MercadoPago."
  },
  {
    img: clockImg,
    title: "Amplia disponibilidad de Turnos",
    text: "Porque sabemos que tu tiempo es valioso, ponemos a tu disposición turnos flexibles para que nunca tengas que preocuparte por tu agenda."
  },
  {
    img: peopleImg,
    title: "Talleres Grupales",
    text: "Contamos con talleres grupales donde podrás compartir experiencias, aprender en equipo y potenciar tus habilidades junto a otros."
  }
];

export function Cards() {
  return (
    <div className="why-us">
      <h2>¿Por qué elegirnos?</h2>
      <div className="cards">
        {cardsData.map((card, index) => (
          <div className="card" key={index}>
            <img src={card.img} alt={card.title} />
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}