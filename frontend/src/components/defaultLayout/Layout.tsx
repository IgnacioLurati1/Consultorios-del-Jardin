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
      <div>
        <ShortcutListener />
        <Header />
        <Outlet />
        <ChatAssistant />
      </div>
    </UndoProvider>
  );
}
