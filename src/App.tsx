import { Routes, Route } from 'react-router-dom';
import Home from './pages/home';
import Config from './pages/config';
import Play from './pages/play';
import Sessions from './pages/sessions';


function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sessions" element={<Sessions />} />
      <Route path="/config" element={<Config />} />
      <Route path="/play" element={<Play />} />
    </Routes>
  );
}

export default App;