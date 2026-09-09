import {Header} from '../header/Header';
import {Outlet} from 'react-router-dom';
import { ChatAssistant } from '../chatAssistant/ChatAssistant';
import { UndoProvider } from '../../context/UndoContext';
import { ShortcutListener } from '../shortcuts/ShortcutListener';

export function Layout() {
  return (
    // El deshacer envuelve todo porque tiene que sobrevivir al cambio de pantalla para
    // poder darse cuenta de que hubo uno: es ahí donde se olvida de lo último que se hizo.
    <UndoProvider>
      <div className="app-shell">
        <ShortcutListener />
        <Header />
        {/* La barra de arriba queda afuera de lo que hace scroll: así la barra de scroll
            aparece al lado del contenido y el verde llega hasta el borde de la ventana. */}
        <div className="app-scroll">
          <Outlet />
        </div>
        <ChatAssistant />
      </div>
    </UndoProvider>
  );
}
